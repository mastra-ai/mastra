import { createLogger as _createLogger } from './index';
import type { LogLevel, TransportMap } from './index';

export * from './index';

// Factory function for creating loggers
export function createLogger(options: { name?: string; level?: LogLevel; transports?: TransportMap }) {
  console.warn('Please import "createLogger" from "@mastra/core/logger" instead of "@mastra/core"');

  return _createLogger(options);
}
