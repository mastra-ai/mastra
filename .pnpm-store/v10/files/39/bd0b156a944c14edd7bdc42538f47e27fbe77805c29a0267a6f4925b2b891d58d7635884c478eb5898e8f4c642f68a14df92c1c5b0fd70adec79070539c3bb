//#region src/middleware/logger.d.ts
/**
 * All kinds of arguments can come through
 *
 * Examples seen are
 * - string
 * - object / hash
 * - values used for string interpolation, basically anything
 *
 * See https://linear.app/inngest/issue/INN-1342/flush-logs-on-function-exitreturns for more details
 *
 * @public
 */
type LogArg = unknown;
/**
 * Based on https://datatracker.ietf.org/doc/html/rfc5424#autoid-11
 * it's pretty reasonable to expect a logger to have the following interfaces
 * available.
 */
interface Logger {
  info(...args: LogArg[]): void;
  warn(...args: LogArg[]): void;
  error(...args: LogArg[]): void;
  debug(...args: LogArg[]): void;
}
/**
 * ProxyLogger aims to provide a thin wrapper on user's provided logger.
 * It's expected to be turned on and off based on the function execution
 * context, so it doesn't result in duplicated logging.
 *
 * And also attempt to allow enough time for the logger to flush all logs.
 *
 * @public
 */
declare class ProxyLogger implements Logger {
  private readonly logger;
  private enabled;
  constructor(logger: Logger);
  info(...args: LogArg[]): void;
  warn(...args: LogArg[]): void;
  error(...args: LogArg[]): void;
  debug(...args: LogArg[]): void;
  enable(): void;
  disable(): void;
  flush(): Promise<void>;
}
//#endregion
export { LogArg, Logger, ProxyLogger };
//# sourceMappingURL=logger.d.ts.map