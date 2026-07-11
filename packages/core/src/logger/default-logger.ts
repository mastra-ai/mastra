import { ConsoleLogger } from '@internal/core/logger';
import type { LogLevel, LoggerTransport } from '@internal/core/logger';

export const createLogger = (options: {
  name?: string;
  level?: LogLevel;
  transports?: Record<string, LoggerTransport>;
}) => {
  const logger = new ConsoleLogger(options);

  logger.warn('createLogger is deprecated. Please use "new ConsoleLogger()" from "@mastra/core/logger" instead.');

  return logger;
};

export { ConsoleLogger, type ConsoleLoggerOptions, type LogFilter, type LogFilterContext } from '@internal/core/logger';
