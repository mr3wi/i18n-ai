// Translation-related types and interfaces

export interface TranslationConfig {
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
  timeout?: number;
}

export interface TranslationStats {
  totalStrings: number;
  successfulTranslations: number;
  failedTranslations: number;
  languages: string[];
  provider: string;
  duration: number;
}

export interface BatchTranslationOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  maxConcurrentRequests?: number;
}

export enum TranslationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIALLY_COMPLETED = 'partially_completed'
}

export interface TranslationJob {
  id: string;
  status: TranslationStatus;
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
  stats?: TranslationStats;
}
