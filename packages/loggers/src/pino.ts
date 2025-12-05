import type { LoggerTransport } from '@mastra/core/logger';
import { LogLevel, MastraLogger } from '@mastra/core/logger';
import pino from 'pino';
import pretty from 'pino-pretty';

type TransportMap = Record<string, LoggerTransport>;

export type { LogLevel } from '@mastra/core/logger';

export interface PinoLoggerOptions {
  name?: string;
  level?: LogLevel;
  transports?: TransportMap;
  overrideDefaultTransports?: boolean;
  formatters?: pino.LoggerOptions['formatters'];
  redact?: pino.LoggerOptions['redact'];
}

interface PinoLoggerInternalOptions extends PinoLoggerOptions {
  /** @internal Used internally for child loggers */
  _logger?: pino.Logger;
}

export class PinoLogger extends MastraLogger {
  protected logger: pino.Logger;

  constructor(options: PinoLoggerOptions = {}) {
    super(options);

    const internalOptions = options as PinoLoggerInternalOptions;

    // If an existing pino logger is provided (for child loggers), use it directly
    if (internalOptions._logger) {
      this.logger = internalOptions._logger;
      return;
    }

    let prettyStream: ReturnType<typeof pretty> | undefined = undefined;
    if (!options.overrideDefaultTransports) {
      prettyStream = pretty({
        colorize: true,
        levelFirst: true,
        ignore: 'pid,hostname',
        colorizeObjects: true,
        translateTime: 'SYS:standard',
        singleLine: false,
      });
    }

    const transportsAry = [...this.getTransports().entries()];
    this.logger = pino(
      {
        name: options.name || 'app',
        level: options.level || LogLevel.INFO,
        formatters: options.formatters,
        redact: options.redact,
      },
      options.overrideDefaultTransports
        ? options?.transports?.default
        : transportsAry.length === 0
          ? prettyStream
          : pino.multistream([
              ...transportsAry.map(([, transport]) => ({
                stream: transport,
                level: options.level || LogLevel.INFO,
              })),
              {
                stream: prettyStream!,
                level: options.level || LogLevel.INFO,
              },
            ]),
    );
  }

  /**
   * Creates a child logger with additional bound context.
   * All logs from the child logger will include the bound context.
   *
   * @param bindings - Key-value pairs to include in all logs from this child logger
   * @returns A new PinoLogger instance with the bound context
   *
   * @example
   * ```typescript
   * const baseLogger = new PinoLogger({ name: 'MyApp' });
   *
   * // Create module-scoped logger
   * const serviceLogger = baseLogger.child({ module: 'UserService' });
   * serviceLogger.info('User created', { userId: '123' });
   * // Output includes: { module: 'UserService', userId: '123', msg: 'User created' }
   *
   * // Create request-scoped logger
   * const requestLogger = baseLogger.child({ requestId: req.id });
   * requestLogger.error('Request failed', { err: error });
   * // Output includes: { requestId: 'abc', msg: 'Request failed', err: {...} }
   * ```
   */
  child(bindings: Record<string, unknown>): PinoLogger {
    const childPino = this.logger.child(bindings);
    const childOptions: PinoLoggerInternalOptions = {
      name: this.name,
      level: this.level,
      transports: Object.fromEntries(this.transports),
      _logger: childPino,
    };
    return new PinoLogger(childOptions);
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
