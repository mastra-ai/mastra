"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }// src/errors.ts
var _worker_threads = require('worker_threads');
var _picocolors = require('picocolors'); var _picocolors2 = _interopRequireDefault(_picocolors);
var PrettyError = class extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }
  }
};
function handleError(error) {
  if (error.loc) {
    console.error(
      _picocolors2.default.bold(
        _picocolors2.default.red(
          `Error parsing: ${error.loc.file}:${error.loc.line}:${error.loc.column}`
        )
      )
    );
  }
  if (error.frame) {
    console.error(_picocolors2.default.red(error.message));
    console.error(_picocolors2.default.dim(error.frame));
  } else if (error instanceof PrettyError) {
    console.error(_picocolors2.default.red(error.message));
  } else {
    console.error(_picocolors2.default.red(error.stack));
  }
  process.exitCode = 1;
  if (!_worker_threads.isMainThread && _worker_threads.parentPort) {
    _worker_threads.parentPort.postMessage("error");
  }
}




exports.PrettyError = PrettyError; exports.handleError = handleError;
