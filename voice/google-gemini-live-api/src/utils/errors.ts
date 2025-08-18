import type { GeminiLiveErrorCode } from '../types';

/**
 * Helper class for consistent error handling across managers and provider
 */
export class GeminiLiveError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly timestamp: number;

  constructor(code: GeminiLiveErrorCode | string, message: string, details?: unknown) {
    super(message);
    this.name = 'GeminiLiveError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
  }

  toEventData() {
    return {
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}
