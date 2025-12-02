import ExtendableError from 'extendable-error';

class GitError extends ExtendableError {
  constructor(code, message) {
    super(`${message}, exit code: ${code}`);
    this.code = code;
  }

}
class ValidationError extends ExtendableError {}
class ExitError extends ExtendableError {
  constructor(code) {
    super(`The process exited with code: ${code}`);
    this.code = code;
  }

}
class PreExitButNotInPreModeError extends ExtendableError {
  constructor() {
    super("pre mode cannot be exited when not in pre mode");
  }

}
class PreEnterButInPreModeError extends ExtendableError {
  constructor() {
    super("pre mode cannot be entered when in pre mode");
  }

}
class InternalError extends ExtendableError {
  constructor(message) {
    super(message);
  }

}

export { ExitError, GitError, InternalError, PreEnterButInPreModeError, PreExitButNotInPreModeError, ValidationError };
