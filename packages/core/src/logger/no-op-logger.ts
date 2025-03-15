import type { BaseLogger } from './base-logger';

export const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as BaseLogger;
