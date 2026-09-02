import type { LoggerTransport, LoggerAdapterContext } from '@mastra/core/logger';
import { LogLevel, MastraLogger, buildLogRecordData, exportTrackedException } from '@mastra/core/logger';
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
  /**
   * Override the key used for the log message.
   * Defaults to Pino's built-in 'msg' key.
   * Set to 'message' for compatibility with Google Cloud Logging,
   * Elastic Common Schema (ECS), Datadog, and AWS CloudWatch.
   * @example 'message'
   */
  messageKey?: string;
}

interface PinoLoggerInternalOptions<CustomLevels extends string = never> extends PinoLoggerOptions<CustomLevels> {
  /** @internal Used internally for child loggers */
  _logger?: pino.Logger<CustomLevels>;
  /** @internal Shared adapter-context ref so root and children correlate together */
  _adapterContextRef?: { current?: LoggerAdapterContext };
}

export class PinoLogger<CustomLevels extends string = never> extends MastraLogger {
  protected logger: pino.Logger<CustomLevels>;
  // Mutable ref shared with child loggers: the root's mixin (which children's
  // pino instances inherit) reads through this ref, so attaching observability
  // to a child (e.g. `new Mastra({ logger: base.child({...}) })`) correlates
  // the records it actually logs through.
  #adapterContextRef: { current?: LoggerAdapterContext };

  constructor(options: PinoLoggerOptions<CustomLevels> = {}) {
    super(options);

    const internalOptions = options as PinoLoggerInternalOptions<CustomLevels>;
    this.#adapterContextRef = internalOptions._adapterContextRef ?? {};

    // If an existing pino logger is provided (for child loggers), use it directly
    if (internalOptions._logger) {
      this.logger = internalOptions._logger;
      return;
    }

    // Compose the user mixin with trace correlation. Pino mixins run
    // synchronously on every log call, so the trace fields land in the
    // native record before serialization — for ALL destinations (stdout,
    // transports, files). Trace fields win on key conflicts.
    const userMixin = options.mixin;
    const correlationMixin: pino.MixinFn<CustomLevels> = (mergeObject, level, logger) => {
      const userFields = userMixin ? userMixin(mergeObject, level, logger) : {};
      const ctx = this.#adapterContextRef.current;
      if (!ctx?.options.correlation) return userFields;
      try {
        return { ...userFields, ...(ctx.resolveTraceFields() ?? {}) };
      } catch {
        return userFields;
      }
    };

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
        mixin: correlationMixin,
        customLevels: options.customLevels,
        messageKey: options.messageKey ?? 'msg',
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
      _adapterContextRef: this.#adapterContextRef,
    };
    return new PinoLogger(childOptions);
  }

  /**
   * Adapter hook (see `AdaptableLogger` in `@mastra/core/logger`): enables
   * native trace correlation (trace_id/span_id merged into the pino record
   * via mixin, for every destination) and observability export derived from
   * the same record. Called by Mastra during setup.
   */
  __attachObservability(ctx: LoggerAdapterContext): void {
    // Shared ref: attaching to a child also enables correlation on the root
    // mixin the child's records flow through (and vice versa).
    this.#adapterContextRef.current = ctx;
  }

  /**
   * The adapter context lives on the ref cell shared by the whole
   * root/child family, so re-attach detection (multi-Mastra warning) must
   * key on that cell — attaching to a child re-targets the root too.
   */
  __observabilityAttachmentKey(): object {
    return this.#adapterContextRef;
  }

  /**
   * Export the record derived from the same native call to observability.
   * Runs regardless of pino's level filter and never throws into the caller.
   */
  #export(level: 'debug' | 'info' | 'warn' | 'error', message: string, args: Record<string, any>): void {
    const ctx = this.#adapterContextRef.current;
    if (!ctx?.options.export) return;
    try {
      // An Error passed as the args value often has no enumerable keys but
      // must still be exported (serialized by buildLogRecordData).
      const hasPayload = args instanceof Error || Object.keys(args).length > 0;
      // Trace identity travels on ExportedLog.traceId/spanId (the sink is
      // span-correlated); data stays reserved for the user payload. The mixin
      // still injects trace fields into the native pino record for stdout.
      ctx.getLogSink()?.[level](message, buildLogRecordData(hasPayload ? [args] : []));
    } catch {
      // Never let observability export break the primary logger
    }
  }

  debug(message: string, args: Record<string, any> = {}): void {
    this.logger.debug(args, message);
    this.#export('debug', message, args);
  }

  info(message: string, args: Record<string, any> = {}): void {
    this.logger.info(args, message);
    this.#export('info', message, args);
  }

  warn(message: string, args: Record<string, any> = {}): void {
    this.logger.warn(args, message);
    this.#export('warn', message, args);
  }

  error(message: string, args: Record<string, any> = {}): void {
    this.logger.error(args, message);
    this.#export('error', message, args);
  }

  override trackException(error: Error, metadata?: Record<string, unknown>): void {
    exportTrackedException(this.#adapterContextRef.current, error, metadata);
  }
}
