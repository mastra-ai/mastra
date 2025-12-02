/* eslint-disable no-console */ // This is the one file where we can `console.log` for the default logger implementation.
import { ConvexError, Value } from "../values/index.js";
import { FunctionFailure } from "./sync/function_result.js";

// This is blue #9 from https://www.radix-ui.com/docs/colors/palette-composition/the-scales
// It must look good in both light and dark mode.
const INFO_COLOR = "color:rgb(0, 145, 255)";

export type UdfType = "query" | "mutation" | "action" | "any";

function prefix_for_source(source: UdfType) {
  switch (source) {
    case "query":
      return "Q";
    case "mutation":
      return "M";
    case "action":
      return "A";
    case "any":
      return "?";
  }
}

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * A logger that can be used to log messages. By default, this is a wrapper
 * around `console`, but can be configured to not log at all or to log somewhere
 * else.
 */
export type Logger = {
  logVerbose(...args: any[]): void;
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
};

export class DefaultLogger implements Logger {
  private _onLogLineFuncs: Record<
    string,
    (level: LogLevel, ...args: any[]) => void
  >;
  private _verbose: boolean;

  constructor(options: { verbose: boolean }) {
    this._onLogLineFuncs = {};
    this._verbose = options.verbose;
  }

  addLogLineListener(
    func: (level: LogLevel, ...args: any[]) => void,
  ): () => void {
    let id = Math.random().toString(36).substring(2, 15);
    for (let i = 0; i < 10; i++) {
      if (this._onLogLineFuncs[id] === undefined) {
        break;
      }
      id = Math.random().toString(36).substring(2, 15);
    }
    this._onLogLineFuncs[id] = func;
    return () => {
      delete this._onLogLineFuncs[id];
    };
  }

  logVerbose(...args: any[]) {
    if (this._verbose) {
      for (const func of Object.values(this._onLogLineFuncs)) {
        func("debug", `${new Date().toISOString()}`, ...args);
      }
    }
  }

  log(...args: any[]) {
    for (const func of Object.values(this._onLogLineFuncs)) {
      func("info", ...args);
    }
  }

  warn(...args: any[]) {
    for (const func of Object.values(this._onLogLineFuncs)) {
      func("warn", ...args);
    }
  }

  error(...args: any[]) {
    for (const func of Object.values(this._onLogLineFuncs)) {
      func("error", ...args);
    }
  }
}

export function instantiateDefaultLogger(options: {
  verbose: boolean;
}): Logger {
  const logger = new DefaultLogger(options);
  logger.addLogLineListener((level, ...args) => {
    switch (level) {
      case "debug":
        console.debug(...args);
        break;
      case "info":
        console.log(...args);
        break;
      case "warn":
        console.warn(...args);
        break;
      case "error":
        console.error(...args);
        break;
      default: {
        level satisfies never;
        console.log(...args);
      }
    }
  });
  return logger;
}

export function instantiateNoopLogger(options: { verbose: boolean }): Logger {
  return new DefaultLogger(options);
}

export function logForFunction(
  logger: Logger,
  type: "info" | "error",
  source: UdfType,
  udfPath: string,
  message: string | { errorData: Value },
) {
  const prefix = prefix_for_source(source);

  if (typeof message === "object") {
    message = `ConvexError ${JSON.stringify(message.errorData, null, 2)}`;
  }
  if (type === "info") {
    const match = message.match(/^\[.*?\] /);
    if (match === null) {
      logger.error(
        `[CONVEX ${prefix}(${udfPath})] Could not parse console.log`,
      );
      return;
    }
    const level = message.slice(1, match[0].length - 2);
    const args = message.slice(match[0].length);

    logger.log(`%c[CONVEX ${prefix}(${udfPath})] [${level}]`, INFO_COLOR, args);
  } else {
    logger.error(`[CONVEX ${prefix}(${udfPath})] ${message}`);
  }
}

export function logFatalError(logger: Logger, message: string): Error {
  const errorMessage = `[CONVEX FATAL ERROR] ${message}`;
  logger.error(errorMessage);
  return new Error(errorMessage);
}

export function createHybridErrorStacktrace(
  source: UdfType,
  udfPath: string,
  result: FunctionFailure,
): string {
  const prefix = prefix_for_source(source);
  return `[CONVEX ${prefix}(${udfPath})] ${result.errorMessage}\n  Called by client`;
}

export function forwardData(
  result: FunctionFailure,
  error: ConvexError<string>,
) {
  (error as ConvexError<any>).data = result.errorData;
  return error;
}
