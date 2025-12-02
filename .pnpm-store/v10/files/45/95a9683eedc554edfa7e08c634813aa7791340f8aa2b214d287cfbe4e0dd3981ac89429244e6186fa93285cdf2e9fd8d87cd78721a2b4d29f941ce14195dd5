'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var ExtendableError = require('extendable-error');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

var ExtendableError__default = /*#__PURE__*/_interopDefault(ExtendableError);

class GitError extends ExtendableError__default["default"] {
  constructor(code, message) {
    super(`${message}, exit code: ${code}`);
    this.code = code;
  }

}
class ValidationError extends ExtendableError__default["default"] {}
class ExitError extends ExtendableError__default["default"] {
  constructor(code) {
    super(`The process exited with code: ${code}`);
    this.code = code;
  }

}
class PreExitButNotInPreModeError extends ExtendableError__default["default"] {
  constructor() {
    super("pre mode cannot be exited when not in pre mode");
  }

}
class PreEnterButInPreModeError extends ExtendableError__default["default"] {
  constructor() {
    super("pre mode cannot be entered when in pre mode");
  }

}
class InternalError extends ExtendableError__default["default"] {
  constructor(message) {
    super(message);
  }

}

exports.ExitError = ExitError;
exports.GitError = GitError;
exports.InternalError = InternalError;
exports.PreEnterButInPreModeError = PreEnterButInPreModeError;
exports.PreExitButNotInPreModeError = PreExitButNotInPreModeError;
exports.ValidationError = ValidationError;
