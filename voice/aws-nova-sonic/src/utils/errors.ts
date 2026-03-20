import type { NovaSonicErrorCode } from '../types';

/**
 * Helper class for consistent error handling across Nova Sonic voice integration
 */
export class NovaSonicError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly timestamp: number;

  constructor(code: NovaSonicErrorCode | string, message: string, details?: unknown) {
    super(message);
    this.name = 'NovaSonicError';
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

