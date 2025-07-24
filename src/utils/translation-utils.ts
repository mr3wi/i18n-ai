import { ExtractedString } from '../parsers/react-parser';

/**
 * Generates a normalized key from an extracted string
 */
export function generateTranslationKey(str: ExtractedString, maxLength: number = 50): string {
  return str.text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, maxLength);
}

/**
 * Validates if a string should be extracted for translation
 */
export function shouldExtractString(text: string): boolean {
  // Basic filters
  if (!text || text.length < 2) return false;
  if (/^[\s\n\r]*$/.test(text)) return false; // Only whitespace
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(text)) return false; // Variable names
  if (/^[./\\]+$/.test(text)) return false; // Relative paths
  if (/^\d+(\.\d+)?$/.test(text)) return false; // Pure numbers
  if (/^#[0-9a-fA-F]{3,8}$/.test(text)) return false; // Hex colors
  if (text.includes('className') || text.includes('onClick')) return false; // React props
  
  return true;
}

/**
 * Splits an array into chunks of specified size
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Delays execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delayMs = baseDelay * Math.pow(2, attempt);
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
      await delay(delayMs);
    }
  }
  
  throw lastError!;
}

/**
 * Sanitizes text for safe display in logs
 */
export function sanitizeForLog(text: string, maxLength: number = 100): string {
  return text.length > maxLength 
    ? `${text.substring(0, maxLength)}...`
    : text;
}

/**
 * Validates language code format
 */
export function isValidLanguageCode(lang: string): boolean {
  // Basic validation for common language codes (ISO 639-1 and some extensions)
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(lang);
}

/**
 * Normalizes language code to lowercase
 */
export function normalizeLanguageCode(lang: string): string {
  return lang.toLowerCase().trim();
}
