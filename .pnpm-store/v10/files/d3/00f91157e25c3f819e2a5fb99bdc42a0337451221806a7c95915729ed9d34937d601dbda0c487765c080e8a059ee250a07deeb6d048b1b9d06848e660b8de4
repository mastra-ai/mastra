"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const INFO_COLOR = "color:rgb(0, 145, 255)";
function prefix_for_source(source) {
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
export class DefaultLogger {
  constructor(options) {
    __publicField(this, "_onLogLineFuncs");
    __publicField(this, "_verbose");
    this._onLogLineFuncs = {};
    this._verbose = options.verbose;
  }
  addLogLineListener(func) {
    let id = Math.random().toString(36).substring(2, 15);
    for (let i = 0; i < 10; i++) {
      if (this._onLogLineFuncs[id] === void 0) {
        break;
      }
      id = Math.random().toString(36).substring(2, 15);
    }
    this._onLogLineFuncs[id] = func;
    return () => {
      delete this._onLogLineFuncs[id];
    };
  }
  logVerbose(...args) {
    if (this._verbose) {
      for (const func of Object.values(this._onLogLineFuncs)) {
        func("debug", `${(/* @__PURE__ */ new Date()).toISOString()}`, ...args);
      }
    }
  }
  log(...args) {
    for (const func of Object.values(this._onLogLineFuncs)) {
      func("info", ...args);
    }
  }
  warn(...args) {
    for (const func of Object.values(this._onLogLineFuncs)) {
      func("warn", ...args);
    }
  }
  error(...args) {
    for (const func of Object.values(this._onLogLineFuncs)) {
      func("error", ...args);
    }
  }
}
export function instantiateDefaultLogger(options) {
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
        level;
        console.log(...args);
      }
    }
  });
  return logger;
}
export function instantiateNoopLogger(options) {
  return new DefaultLogger(options);
}
export function logForFunction(logger, type, source, udfPath, message) {
  const prefix = prefix_for_source(source);
  if (typeof message === "object") {
    message = `ConvexError ${JSON.stringify(message.errorData, null, 2)}`;
  }
  if (type === "info") {
    const match = message.match(/^\[.*?\] /);
    if (match === null) {
      logger.error(
        `[CONVEX ${prefix}(${udfPath})] Could not parse console.log`
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
export function logFatalError(logger, message) {
  const errorMessage = `[CONVEX FATAL ERROR] ${message}`;
  logger.error(errorMessage);
  return new Error(errorMessage);
}
export function createHybridErrorStacktrace(source, udfPath, result) {
  const prefix = prefix_for_source(source);
  return `[CONVEX ${prefix}(${udfPath})] ${result.errorMessage}
  Called by client`;
}
export function forwardData(result, error) {
  error.data = result.errorData;
  return error;
}
//# sourceMappingURL=logging.js.map
