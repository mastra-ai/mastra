"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var log_exports = {};
__export(log_exports, {
  changeSpinner: () => changeSpinner,
  failExistingSpinner: () => failExistingSpinner,
  logError: () => logError,
  logFailure: () => logFailure,
  logFinishedStep: () => logFinishedStep,
  logMessage: () => logMessage,
  logOutput: () => logOutput,
  logVerbose: () => logVerbose,
  logWarning: () => logWarning,
  showSpinner: () => showSpinner,
  showSpinnerIfSlow: () => showSpinnerIfSlow,
  startLogProgress: () => startLogProgress,
  stopSpinner: () => stopSpinner
});
module.exports = __toCommonJS(log_exports);
var import_util = require("util");
var import_chalk = __toESM(require("chalk"), 1);
var import_progress = __toESM(require("../vendor/progress/index.js"), 1);
var import_ora = __toESM(require("ora"), 1);
let spinner = null;
function logToStderr(...args) {
  process.stderr.write(`${(0, import_util.format)(...args)}
`);
}
function logError(message) {
  spinner?.clear();
  logToStderr(message);
}
function logWarning(...logged) {
  spinner?.clear();
  logToStderr(...logged);
}
function logMessage(...logged) {
  spinner?.clear();
  logToStderr(...logged);
}
function logOutput(...logged) {
  spinner?.clear();
  console.log(...logged);
}
function logVerbose(...logged) {
  if (process.env.CONVEX_VERBOSE) {
    logMessage(`[verbose] ${(/* @__PURE__ */ new Date()).toISOString()}`, ...logged);
  }
}
function startLogProgress(format2, progressBarOptions) {
  spinner?.clear();
  return new import_progress.default(format2, progressBarOptions);
}
function showSpinner(message) {
  spinner?.stop();
  spinner = (0, import_ora.default)({
    // Add newline to prevent clobbering when a message
    // we can't pipe through `logMessage` et al gets printed
    text: message + "\n",
    stream: process.stderr,
    // hideCursor: true doesn't work with `tsx`.
    // see https://github.com/tapjs/signal-exit/issues/49#issuecomment-1459408082
    // See CX-6822 for an issue to bring back cursor hiding, probably by upgrading libraries.
    hideCursor: process.env.CONVEX_RUNNING_LIVE_IN_MONOREPO ? false : true
  }).start();
}
function changeSpinner(message) {
  if (spinner) {
    spinner.text = message + "\n";
  } else {
    logToStderr(message);
  }
}
function failExistingSpinner() {
  spinner?.fail();
  spinner = null;
}
function logFailure(message) {
  if (spinner) {
    spinner.fail(message);
    spinner = null;
  } else {
    logToStderr(`${import_chalk.default.red(`\u2716`)} ${message}`);
  }
}
function logFinishedStep(message) {
  if (spinner) {
    spinner.succeed(message);
    spinner = null;
  } else {
    logToStderr(`${import_chalk.default.green(`\u2714`)} ${message}`);
  }
}
function stopSpinner() {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
}
async function showSpinnerIfSlow(message, delayMs, fn) {
  const timeout = setTimeout(() => {
    showSpinner(message);
  }, delayMs);
  await fn();
  clearTimeout(timeout);
}
//# sourceMappingURL=log.js.map
