import fs from 'fs';
import path from 'path';
import { ExtractedString } from './parsers/react-parser';
import { generateTranslationKey, retryWithBackoff, normalizeLanguageCode } from './utils/translation-utils';
import { TranslationConfig } from './types/translation';

// Constants
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEEPL_API_URL = {
  FREE: 'https://api-free.deepl.com/v2/translate',
  PRO: 'https://api.deepl.com/v2/translate',
};

const BATCH_SEPARATOR = '|||';

// Types
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  language: string;
  confidence?: number;
  context?: string;
}

export interface TranslationProvider {
  name: string;
  translate(text: string, targetLang: string, context?: string): Promise<string>;
  translateBatch(texts: string[], targetLang: string, contexts?: string[]): Promise<string[]>;
}

// Custom Error Classes
export class TranslationError extends Error {
  constructor(message: string, public provider: string, public originalError?: Error) {
    super(message);
    this.name = 'TranslationError';
  }
}

export class APIError extends TranslationError {
  constructor(message: string, provider: string, public statusCode?: number, originalError?: Error) {
    super(message, provider, originalError);
    this.name = 'APIError';
  }
}

// HTTP Utility Functions
async function makeHTTPRequest<T>(
  url: string,
  options: RequestInit,
  providerName: string
): Promise<T> {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new APIError(
        `HTTP ${response.status}: ${response.statusText}`,
        providerName,
        response.status
      );
    }

    return await response.json() as T;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new TranslationError(
      `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      providerName,
      error instanceof Error ? error : undefined
    );
  }
}

// Base Translator Class
abstract class BaseTranslator implements TranslationProvider {
  abstract name: string;
  protected apiKey: string;
  protected config: TranslationConfig;

  constructor(apiKey: string, config: TranslationConfig = {}) {
    if (!apiKey?.trim()) {
      throw new Error(`API key is required for translator`);
    }
    this.apiKey = apiKey;
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 10,
      timeout: 30000,
      ...config
    };
  }

  abstract translate(text: string, targetLang: string, context?: string): Promise<string>;
  abstract translateBatch(texts: string[], targetLang: string, contexts?: string[]): Promise<string[]>;

  protected async fallbackToIndividualTranslations(
    texts: string[],
    targetLang: string,
    contexts?: string[]
  ): Promise<string[]> {
    console.warn(`⚠️ Falling back to individual translations for ${this.name}`);
    const results = [];
    
    for (let i = 0; i < texts.length; i++) {
      try {
        const translation = await retryWithBackoff(
          () => this.translate(texts[i], targetLang, contexts?.[i]),
          this.config.maxRetries,
          this.config.retryDelay
        );
        results.push(translation);
      } catch (error) {
        console.error(`Failed to translate "${texts[i]}":`, error);
        results.push(texts[i]); // Keep original on error
      }
    }
    
    return results;
  }

  protected normalizeLanguage(lang: string): string {
    return normalizeLanguageCode(lang);
  }
}

export class OpenAITranslator extends BaseTranslator {
  name = 'OpenAI';
  private model = 'gpt-3.5-turbo';

  constructor(apiKey: string, config: TranslationConfig = {}) {
    super(apiKey, config);
  }

  async translate(text: string, targetLang: string, context?: string): Promise<string> {
    const prompt = this.buildPrompt(text, this.normalizeLanguage(targetLang), context);

    try {
      const data = await makeHTTPRequest<OpenAIResponse>(
        OPENAI_API_URL,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'system',
                content: this.getSystemPrompt(),
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: 150,
            temperature: 0.3,
          }),
        },
        this.name
      );

      return this.extractTranslationFromResponse(data) || text;
    } catch (error) {
      console.error('OpenAI translation error:', error);
      throw new TranslationError(
        `Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async translateBatch(texts: string[], targetLang: string, contexts?: string[]): Promise<string[]> {
    const normalizedLang = this.normalizeLanguage(targetLang);
    const batchPrompt = this.buildBatchPrompt(texts, normalizedLang, contexts);

    try {
      const data = await makeHTTPRequest<OpenAIResponse>(
        OPENAI_API_URL,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: 'system',
                content: this.getBatchSystemPrompt(),
              },
              {
                role: 'user',
                content: batchPrompt,
              },
            ],
            max_tokens: 1000,
            temperature: 0.3,
          }),
        },
        this.name
      );

      const result = this.extractTranslationFromResponse(data);
      if (result) {
        return result.split(BATCH_SEPARATOR).map((t) => t.trim());
      }

      return texts; // Fallback
    } catch (error) {
      console.error('OpenAI batch translation error:', error);
      return this.fallbackToIndividualTranslations(texts, targetLang, contexts);
    }
  }

  private getSystemPrompt(): string {
    return 'You are a professional translator specializing in software localization. Provide accurate, contextually appropriate translations that maintain the original meaning and tone.';
  }

  private getBatchSystemPrompt(): string {
    return `You are a professional translator. Translate the following texts maintaining consistency across all translations. Return only the translations in the same order, separated by ${BATCH_SEPARATOR} markers.`;
  }

  private extractTranslationFromResponse(data: OpenAIResponse): string | undefined {
    if (Array.isArray(data.choices) && data.choices.length > 0) {
      return data.choices[0]?.message?.content?.trim();
    }
    return undefined;
  }

  private buildPrompt(text: string, targetLang: string, context?: string): string {
    let prompt = `Translate the following text to ${targetLang}:\n\n"${text}"`;

    if (context) {
      prompt += `\n\nContext: This text appears in ${context}`;
    }

    prompt += '\n\nProvide only the translation, no explanation.';
    return prompt;
  }

  private buildBatchPrompt(texts: string[], targetLang: string, contexts?: string[]): string {
    let prompt = `Translate the following texts to ${targetLang}. Return only the translations separated by ${BATCH_SEPARATOR}:\n\n`;

    texts.forEach((text, index) => {
      prompt += `${index + 1}. "${text}"`;
      if (contexts?.[index]) {
        prompt += ` (Context: ${contexts[index]})`;
      }
      prompt += '\n';
    });

    return prompt;
  }
}

// Type definitions for API responses
interface OpenAIResponse {
  choices: {
    message?: {
      content?: string;
    };
  }[];
}

export class DeepLTranslator extends BaseTranslator {
  name = 'DeepL';
  private baseUrl: string;

  constructor(apiKey: string, isPro: boolean = false, config: TranslationConfig = {}) {
    super(apiKey, config);
    this.baseUrl = isPro ? DEEPL_API_URL.PRO : DEEPL_API_URL.FREE;
  }

  async translate(text: string, targetLang: string, context?: string): Promise<string> {
    try {
      const data = await makeHTTPRequest<DeepLResponse>(
        this.baseUrl,
        {
          method: 'POST',
          headers: {
            Authorization: `DeepL-Auth-Key ${this.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            text: text,
            target_lang: this.mapLanguageCode(this.normalizeLanguage(targetLang)),
            formality: 'default',
          }),
        },
        this.name
      );

      return data.translations[0]?.text || text;
    } catch (error) {
      console.error('DeepL translation error:', error);
      throw new TranslationError(
        `Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async translateBatch(texts: string[], targetLang: string, contexts?: string[]): Promise<string[]> {
    const normalizedLang = this.normalizeLanguage(targetLang);
    try {
      const data = await makeHTTPRequest<DeepLResponse>(
        this.baseUrl,
        {
          method: 'POST',
          headers: {
            Authorization: `DeepL-Auth-Key ${this.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            text: texts,
            target_lang: this.mapLanguageCode(normalizedLang),
            formality: 'default',
          } as any),
        },
        this.name
      );

      return data.translations.map((t) => t.text);
    } catch (error) {
      console.error('DeepL batch translation error:', error);
      return this.fallbackToIndividualTranslations(texts, targetLang, contexts);
    }
  }

  private mapLanguageCode(lang: string): string {
    const mapping: Record<string, string> = {
      en: 'EN',
      fr: 'FR',
      es: 'ES',
      de: 'DE',
      it: 'IT',
      pt: 'PT',
      ru: 'RU',
      ja: 'JA',
      zh: 'ZH',
    };
    return mapping[lang.toLowerCase()] || lang.toUpperCase();
  }
}

// Type definitions for DeepL API response
interface DeepLResponse {
  translations: {
    text: string;
  }[];
}

// Translation File Generator
export class TranslationFileGenerator {
  constructor(private outputDir: string = './locales') {}

  generateFiles(
    translations: Map<string, TranslationResult[]>,
    extractedStrings: ExtractedString[]
  ): void {
    this.ensureOutputDirectory();

    translations.forEach((results, language) => {
      const translationMap = this.buildTranslationMap(results, extractedStrings);
      
      this.saveJSONFile(language, translationMap);
      this.saveI18nextFile(language, translationMap);
      
      console.log(`💾 ${language} translations saved`);
    });
  }

  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private buildTranslationMap(
    results: TranslationResult[],
    extractedStrings: ExtractedString[]
  ): Record<string, string> {
    const translationMap: Record<string, string> = {};

    results.forEach((result, index) => {
      const key = this.generateKey(extractedStrings[index]);
      translationMap[key] = result.translatedText;
    });

    return translationMap;
  }

  private saveJSONFile(language: string, translations: Record<string, string>): void {
    const jsonPath = path.join(this.outputDir, `${language}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(translations, null, 2));
  }

  private saveI18nextFile(language: string, translations: Record<string, string>): void {
    const i18nextFormat = { translation: translations };
    const i18nextPath = path.join(this.outputDir, `${language}-i18next.json`);
    fs.writeFileSync(i18nextPath, JSON.stringify(i18nextFormat, null, 2));
  }

  private generateKey(str: ExtractedString): string {
    return generateTranslationKey(str);
  }
}

export class AITranslationService {
  private providers: Map<string, TranslationProvider> = new Map();

  addProvider(provider: TranslationProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): TranslationProvider | undefined {
    return this.providers.get(name);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async translateStrings(
    extractedStrings: ExtractedString[],
    targetLanguages: string[],
    providerName: string = 'OpenAI'
  ): Promise<Map<string, TranslationResult[]>> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found. Available providers: ${this.listProviders().join(', ')}`);
    }

    if (extractedStrings.length === 0) {
      console.warn('⚠️ No strings to translate');
      return new Map();
    }

    const results = new Map<string, TranslationResult[]>();
    const texts = extractedStrings.map((s) => s.text);
    const contexts = extractedStrings.map((s) => s.context);

    for (const lang of targetLanguages) {
      console.log(`🌍 Translating to ${lang} using ${provider.name}...`);

      try {
        const translations = await provider.translateBatch(texts, lang, contexts);

        const langResults: TranslationResult[] = translations.map((translation, index) => ({
          originalText: extractedStrings[index].text,
          translatedText: translation,
          language: lang,
          context: extractedStrings[index].context,
        }));

        results.set(lang, langResults);
        console.log(`✅ ${lang}: ${translations.length} strings translated`);
      } catch (error) {
        console.error(`❌ Failed to translate to ${lang}:`, error);

        // Fallback: keep original texts
        const fallbackResults: TranslationResult[] = extractedStrings.map((str) => ({
          originalText: str.text,
          translatedText: str.text,
          language: lang,
          context: str.context,
        }));

        results.set(lang, fallbackResults);
      }
    }

    return results;
  }

  generateTranslationFiles(
    translations: Map<string, TranslationResult[]>,
    extractedStrings: ExtractedString[],
    outputDir: string = './locales'
  ): void {
    const generator = new TranslationFileGenerator(outputDir);
    generator.generateFiles(translations, extractedStrings);
  }
}
