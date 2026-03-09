import {MastraLogger} from '@mastra/core/logger';
import pino from 'pino';

const level = 'debug';

const createLogger = () =>
  pino({
    level,
    formatters: {
      level: label => ({level: label.toUpperCase()}),
    },
  });

export const rootLogger = createLogger();

/**
 * This is a wrapper around the pino logger to make it compatible with the MastraLogger interface. While mastra ships something
 * similar, it uses a different configuration structure so using this enables us to use the same root logger for both Mastra and non-Mastra code.
 */
export class PinoWrapperLogger extends MastraLogger {
  protected logger: pino.Logger;

  constructor(
    options: {
      name?: string;
    } = {},
  ) {
    super({
      level: 'info',
    });

    this.logger = rootLogger.child({
      module: options.name || 'app',
    });
  }

  debug(message: string, args: Record<string, any> = {}): void {
    this.logger.debug(args, message);
  }

  info(message: string, args: Record<string, any> = {}): void {
    this.logger.info(args, message);
  }

  warn(message: string, args: Record<string, any> = {}): void {
    this.logger.warn(args, message);
  }

  error(message: string, args: Record<string, any> = {}): void {
    this.logger.error(args, message);
  }
}
