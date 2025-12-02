/* global module */
/**
 * This subclass of Error supports chaining.
 * If available, it uses the built-in support for property `.cause`.
 * Otherwise, it sets it up itself.
 *
 * @see https://github.com/tc39/proposal-error-cause
 */
class CausedError extends Error {
  constructor(message, options) {
    super(message, options);
    if (isObject(options) && "cause" in options && !("cause" in this)) {
      const cause = options.cause;
      this.cause = cause;
      if ("stack" in cause) {
        this.stack = this.stack + "\nCAUSE: " + cause.stack;
      }
    }
  }
}

function isObject(value) {
  return value !== null && typeof value === "object";
}

module.exports = CausedError;
