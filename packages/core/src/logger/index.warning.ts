import { createLogger as _createLogger } from './logger';
import type { TransportMap } from './transport';
import type { LogLevel } from './types';

export * from './index';

// Factory function for creating loggers
export function createLogger(options: { name?: string; level?: LogLevel; transports?: TransportMap }) {
  console.warn('Please import "createLogger" from "@mastra/core/logger" instead of "@mastra/core"');

  return _createLogger(options);
}
