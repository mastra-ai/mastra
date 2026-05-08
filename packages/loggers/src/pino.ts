import type { LoggerTransport } from '@mastra/core/logger';
import { LogLevel, MastraLogger } from '@mastra/core/logger';
import pino from 'pino';
import pretty from 'pino-pretty';

type TransportMap = Record<string, LoggerTransport>;

export type { LogLevel } from '@mastra/core/logger';

export interface PinoLoggerOptions<CustomLevels extends string = never> {
  name?: string;
  level?: LogLevel;
  transports?: TransportMap;
  overrideDefaultTransports?: boolean;
  formatters?: pino.LoggerOptions['formatters'];
  redact?: pino.LoggerOptions['redact'];
  mixin?: pino.MixinFn<CustomLevels>;
  customLevels?: { [level in CustomLevels]: number };
  /**
   * When false, disables pino-pretty and outputs raw JSON.
   * Useful when sending logs to aggregators like Datadog,
   * Loki, or CloudWatch that expect single-line JSON per entry.
   * @default true
   */
  prettyPrint?: boolean;
}

interface PinoLoggerInternalOptions<CustomLevels extends string = never> extends PinoLoggerOptions<CustomLevels> {
  /** @internal Used internally for child loggers */
  _logger?: pino.Logger<CustomLevels>;
}

export class PinoLogger<CustomLevels extends string = never> extends MastraLogger {
  protected logger: pino.Logger<CustomLevels>;

  constructor(options: PinoLoggerOptions<CustomLevels> = {}) {
    super(options);

    const internalOptions = options as PinoLoggerInternalOptions<CustomLevels>;

    // If an existing pino logger is provided (for child loggers), use it directly
    if (internalOptions._logger) {
      this.logger = internalOptions._logger;
      return;
    }

    const shouldPrettyPrint = options.prettyPrint ?? true;
    let prettyStream: ReturnType<typeof pretty> | undefined = undefined;
    if (!options.overrideDefaultTransports && shouldPrettyPrint) {
      prettyStream = pretty({
        colorize: true,
        levelFirst: true,
        ignore: 'pid,hostname,component',
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
        mixin: options.mixin,
        customLevels: options.customLevels,
      },
      options.overrideDefaultTransports
        ? options?.transports?.default
        : transportsAry.length === 0
          ? prettyStream // undefined when prettyPrint:false → pino native JSON
          : pino.multistream([
              ...transportsAry.map(([, transport]) => ({
                stream: transport,
                level: options.level || LogLevel.INFO,
              })),
              ...(prettyStream // only add prettyStream to multistream if it exists
                ? [{ stream: prettyStream, level: options.level || LogLevel.INFO }]
                : []),
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
  child(bindings: Record<string, unknown>): PinoLogger<CustomLevels> {
    const childPino = this.logger.child(bindings);
    const childOptions: PinoLoggerInternalOptions<CustomLevels> = {
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
