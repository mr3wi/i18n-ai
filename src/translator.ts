import fs from 'fs';
import path from 'path';
import { ExtractedString } from './parsers/react-parser';

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

export class OpenAITranslator implements TranslationProvider {
  name = 'OpenAI';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async translate(text: string, targetLang: string, context?: string): Promise<string> {
    const prompt = this.buildPrompt(text, targetLang, context);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You are a professional translator specializing in software localization. Provide accurate, contextually appropriate translations that maintain the original meaning and tone.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 150,
          temperature: 0.3,
        }),
      });

      const data = (await response.json()) as { choices: { message?: { content?: string } }[] };
      if (Array.isArray(data.choices) && data.choices.length > 0) {
        return data.choices[0]?.message?.content?.trim() || text;
      }
      return text;
    } catch (error) {
      console.error('OpenAI translation error:', error);
      throw new Error(`Translation failed: ${error}`);
    }
  }

  async translateBatch(texts: string[], targetLang: string, contexts?: string[]): Promise<string[]> {
    const batchPrompt = this.buildBatchPrompt(texts, targetLang, contexts);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You are a professional translator. Translate the following texts maintaining consistency across all translations. Return only the translations in the same order, separated by ||| markers.',
            },
            {
              role: 'user',
              content: batchPrompt,
            },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
      });

      const data = (await response.json()) as {
        choices: { message?: { content?: string } }[];
      };
      let result: string | undefined = undefined;
      if (Array.isArray(data.choices) && data.choices.length > 0) {
        result = data.choices[0]?.message?.content?.trim();
      }

      if (result) {
        return result.split('|||').map((t) => t.trim());
      }

      return texts; // Fallback
    } catch (error) {
      console.error('OpenAI batch translation error:', error);
      // Fallback to individual translations
      const results = [];
      for (let i = 0; i < texts.length; i++) {
        try {
          results.push(await this.translate(texts[i], targetLang, contexts?.[i]));
        } catch {
          results.push(texts[i]); // Keep original on error
        }
      }
      return results;
    }
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
    let prompt = `Translate the following texts to ${targetLang}. Return only the translations separated by |||:\n\n`;

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

export class GeminiTranslator implements TranslationProvider {
  name = 'Gemini';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
  }

  async translate(text: string, targetLang: string, context?: string): Promise<string> {
    const prompt = this.buildPrompt(text, targetLang, context);

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      });

      const data = (await response.json()) as {
        candidates: { content?: { parts?: { text?: string }[] } }[];
      };

      if (data.candidates && data.candidates.length > 0) {
        const content = data.candidates[0]?.content?.parts?.[0]?.text?.trim();
        return content || text;
      }
      return text;
    } catch (error) {
      console.error('Gemini translation error:', error);
      throw new Error(`Translation failed: ${error}`);
    }
  }

  async translateBatch(texts: string[], targetLang: string, contexts?: string[]): Promise<string[]> {
    const batchPrompt = this.buildBatchPrompt(texts, targetLang, contexts);

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: batchPrompt,
                },
              ],
            },
          ],
        }),
      });

      const data = (await response.json()) as {
        candidates: { content?: { parts?: { text?: string }[] } }[];
      };

      if (data.candidates && data.candidates.length > 0) {
        const content = data.candidates[0]?.content?.parts?.[0]?.text?.trim();
        if (content) {
          return content.split('|||').map((t) => t.trim());
        }
      }

      return texts; // Fallback
    } catch (error) {
      console.error('Gemini batch translation error:', error);
      // Fallback to individual translations
      const results = [];
      for (let i = 0; i < texts.length; i++) {
        try {
          results.push(await this.translate(texts[i], targetLang, contexts?.[i]));
        } catch {
          results.push(texts[i]); // Keep original on error
        }
      }
      return results;
    }
  }

  private buildPrompt(text: string, targetLang: string, context?: string): string {
    let prompt = `You are a professional translator specializing in software localization. Translate the following text to ${targetLang}:\n\n"${text}"`;

    if (context) {
      prompt += `\n\nContext: This text appears in ${context}`;
    }

    prompt += '\n\nProvide only the translation, no explanation or additional text.';
    return prompt;
  }

  private buildBatchPrompt(texts: string[], targetLang: string, contexts?: string[]): string {
    let prompt = `You are a professional translator specializing in software localization. Translate the following texts to ${targetLang}. Return only the translations separated by ||| markers (three pipe characters):\n\n`;

    texts.forEach((text, index) => {
      prompt += `${index + 1}. "${text}"`;
      if (contexts?.[index]) {
        prompt += ` (Context: ${contexts[index]})`;
      }
      prompt += '\n';
    });

    prompt += '\nReturn format: translation1|||translation2|||translation3 (etc.)';
    return prompt;
  }
}

export class DeepLTranslator implements TranslationProvider {
  name = 'DeepL';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, isPro: boolean = false) {
    this.apiKey = apiKey;
    this.baseUrl = isPro ? 'https://api.deepl.com/v2/translate' : 'https://api-free.deepl.com/v2/translate';
  }

  async translate(text: string, targetLang: string, context?: string): Promise<string> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text: text,
          target_lang: this.mapLanguageCode(targetLang),
          formality: 'default',
        }),
      });

      const data = (await response.json()) as { translations: { text: string }[] };
      return data.translations[0]?.text || text;
    } catch (error) {
      console.error('DeepL translation error:', error);
      throw new Error(`Translation failed: ${error}`);
    }
  }

  async translateBatch(texts: string[], targetLang: string): Promise<string[]> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text: texts,
          target_lang: this.mapLanguageCode(targetLang),
          formality: 'default',
        } as any),
      });

      const data = (await response.json()) as { translations: { text: string }[] };
      return data.translations.map((t: any) => t.text);
    } catch (error) {
      console.error('DeepL batch translation error:', error);
      // Fallback to individual translations
      const results = [];
      for (const text of texts) {
        try {
          results.push(await this.translate(text, targetLang));
        } catch {
          results.push(text);
        }
      }
      return results;
    }
  }

  private mapLanguageCode(lang: string): string {
    const mapping: { [key: string]: string } = {
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

export class AITranslationService {
  private providers: Map<string, TranslationProvider> = new Map();

  constructor() {}

  addProvider(provider: TranslationProvider): void {
    this.providers.set(provider.name, provider);
  }

  async translateStrings(
    extractedStrings: ExtractedString[],
    targetLanguages: string[],
    providerName: string = 'OpenAI'
  ): Promise<Map<string, TranslationResult[]>> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    const results = new Map<string, TranslationResult[]>();

    for (const lang of targetLanguages) {
      console.log(`🌍 Translating to ${lang} using ${provider.name}...`);

      const texts = extractedStrings.map((s) => s.text);
      const contexts = extractedStrings.map((s) => s.context);

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
    // Créer le dossier de sortie s'il n'existe pas
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    translations.forEach((results, language) => {
      // Format JSON simple
      const jsonTranslations: { [key: string]: string } = {};

      results.forEach((result, index) => {
        const key = this.generateKey(extractedStrings[index]);
        jsonTranslations[key] = result.translatedText;
      });

      // Sauvegarder en JSON
      const jsonPath = path.join(outputDir, `${language}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(jsonTranslations, null, 2));

      // Sauvegarder en format i18next
      const i18nextFormat = {
        translation: jsonTranslations,
      };
      const i18nextPath = path.join(outputDir, `${language}-i18next.json`);
      fs.writeFileSync(i18nextPath, JSON.stringify(i18nextFormat, null, 2));

      console.log(`💾 ${language} translations saved to ${jsonPath}`);
    });
  }

  private generateKey(str: ExtractedString): string {
    return str.text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Retire les accents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50);
  }
}
