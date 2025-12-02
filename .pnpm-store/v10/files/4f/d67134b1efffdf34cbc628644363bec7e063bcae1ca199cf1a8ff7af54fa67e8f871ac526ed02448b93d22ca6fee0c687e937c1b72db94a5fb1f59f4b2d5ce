// src/exception.ts
import { format } from "util";
var Exception = class extends Error {
  /**
   * Name of the class that raised the exception.
   */
  name;
  /**
   * A status code for the error. Usually helpful when converting errors
   * to HTTP responses.
   */
  status;
  constructor(message, options) {
    super(message, options);
    const ErrorConstructor = this.constructor;
    this.name = ErrorConstructor.name;
    this.message = message || ErrorConstructor.message || "";
    this.status = options?.status || ErrorConstructor.status || 500;
    const code = options?.code || ErrorConstructor.code;
    if (code !== void 0) {
      this.code = code;
    }
    const help = ErrorConstructor.help;
    if (help !== void 0) {
      this.help = help;
    }
    Error.captureStackTrace(this, ErrorConstructor);
  }
  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
  toString() {
    if (this.code) {
      return `${this.name} [${this.code}]: ${this.message}`;
    }
    return `${this.name}: ${this.message}`;
  }
};
var InvalidArgumentsException = class extends Exception {
  static code = "E_INVALID_ARGUMENTS_EXCEPTION";
  static status = 500;
};
var RuntimeException = class extends Exception {
  static code = "E_RUNTIME_EXCEPTION";
  static status = 500;
};
function createError(message, code, status) {
  return class extends Exception {
    static message = message;
    static code = code;
    static status = status;
    constructor(args, options) {
      super(format(message, ...args || []), options);
      this.name = "Exception";
    }
  };
}
export {
  Exception,
  InvalidArgumentsException,
  RuntimeException,
  createError
};
