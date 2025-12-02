//#region src/env/color-depth.d.ts
declare function getColorDepth(): number;
//#endregion
//#region src/env/env-impl.d.ts
type EnvObject = Record<string, string | undefined>;
declare const env: EnvObject;
declare const nodeENV: string;
/** Detect if `NODE_ENV` environment variable is `production` */
declare const isProduction: boolean;
/** Detect if `NODE_ENV` environment variable is `dev` or `development` */
declare const isDevelopment: () => boolean;
/** Detect if `NODE_ENV` environment variable is `test` */
declare const isTest: () => boolean;
/**
 * Get environment variable with fallback
 */
declare function getEnvVar<Fallback extends string>(key: string, fallback?: Fallback): Fallback extends string ? string : string | undefined;
/**
 * Get boolean environment variable
 */
declare function getBooleanEnvVar(key: string, fallback?: boolean): boolean;
/**
 * Common environment variables used in Better Auth
 */
declare const ENV: Readonly<{
  readonly BETTER_AUTH_SECRET: string;
  readonly AUTH_SECRET: string;
  readonly BETTER_AUTH_TELEMETRY: string;
  readonly BETTER_AUTH_TELEMETRY_ID: string;
  readonly NODE_ENV: string;
  readonly PACKAGE_VERSION: string;
  readonly BETTER_AUTH_TELEMETRY_ENDPOINT: string;
}>;
//#endregion
//#region src/env/logger.d.ts
declare const TTY_COLORS: {
  readonly reset: "\u001B[0m";
  readonly bright: "\u001B[1m";
  readonly dim: "\u001B[2m";
  readonly undim: "\u001B[22m";
  readonly underscore: "\u001B[4m";
  readonly blink: "\u001B[5m";
  readonly reverse: "\u001B[7m";
  readonly hidden: "\u001B[8m";
  readonly fg: {
    readonly black: "\u001B[30m";
    readonly red: "\u001B[31m";
    readonly green: "\u001B[32m";
    readonly yellow: "\u001B[33m";
    readonly blue: "\u001B[34m";
    readonly magenta: "\u001B[35m";
    readonly cyan: "\u001B[36m";
    readonly white: "\u001B[37m";
  };
  readonly bg: {
    readonly black: "\u001B[40m";
    readonly red: "\u001B[41m";
    readonly green: "\u001B[42m";
    readonly yellow: "\u001B[43m";
    readonly blue: "\u001B[44m";
    readonly magenta: "\u001B[45m";
    readonly cyan: "\u001B[46m";
    readonly white: "\u001B[47m";
  };
};
type LogLevel = "info" | "success" | "warn" | "error" | "debug";
declare const levels: readonly ["info", "success", "warn", "error", "debug"];
declare function shouldPublishLog(currentLogLevel: LogLevel, logLevel: LogLevel): boolean;
interface Logger {
  disabled?: boolean | undefined;
  disableColors?: boolean | undefined;
  level?: Exclude<LogLevel, "success"> | undefined;
  log?: ((level: Exclude<LogLevel, "success">, message: string, ...args: any[]) => void) | undefined;
}
type LogHandlerParams = Parameters<NonNullable<Logger["log"]>> extends [LogLevel, ...infer Rest] ? Rest : never;
type InternalLogger = { [K in LogLevel]: (...params: LogHandlerParams) => void } & {
  get level(): LogLevel;
};
declare const createLogger: (options?: Logger | undefined) => InternalLogger;
declare const logger: InternalLogger;
//#endregion
export { isTest as _, TTY_COLORS as a, logger as c, EnvObject as d, env as f, isProduction as g, isDevelopment as h, Logger as i, shouldPublishLog as l, getEnvVar as m, LogHandlerParams as n, createLogger as o, getBooleanEnvVar as p, LogLevel as r, levels as s, InternalLogger as t, ENV as u, nodeENV as v, getColorDepth as y };