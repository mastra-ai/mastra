"use strict";
import { format } from "util";
import chalk from "chalk";
import ProgressBar from "../vendor/progress/index.js";
import ora from "ora";
let spinner = null;
function logToStderr(...args) {
  process.stderr.write(`${format(...args)}
`);
}
export function logError(message) {
  spinner?.clear();
  logToStderr(message);
}
export function logWarning(...logged) {
  spinner?.clear();
  logToStderr(...logged);
}
export function logMessage(...logged) {
  spinner?.clear();
  logToStderr(...logged);
}
export function logOutput(...logged) {
  spinner?.clear();
  console.log(...logged);
}
export function logVerbose(...logged) {
  if (process.env.CONVEX_VERBOSE) {
    logMessage(`[verbose] ${(/* @__PURE__ */ new Date()).toISOString()}`, ...logged);
  }
}
export function startLogProgress(format2, progressBarOptions) {
  spinner?.clear();
  return new ProgressBar(format2, progressBarOptions);
}
export function showSpinner(message) {
  spinner?.stop();
  spinner = ora({
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
export function changeSpinner(message) {
  if (spinner) {
    spinner.text = message + "\n";
  } else {
    logToStderr(message);
  }
}
export function failExistingSpinner() {
  spinner?.fail();
  spinner = null;
}
export function logFailure(message) {
  if (spinner) {
    spinner.fail(message);
    spinner = null;
  } else {
    logToStderr(`${chalk.red(`\u2716`)} ${message}`);
  }
}
export function logFinishedStep(message) {
  if (spinner) {
    spinner.succeed(message);
    spinner = null;
  } else {
    logToStderr(`${chalk.green(`\u2714`)} ${message}`);
  }
}
export function stopSpinner() {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
}
export async function showSpinnerIfSlow(message, delayMs, fn) {
  const timeout = setTimeout(() => {
    showSpinner(message);
  }, delayMs);
  await fn();
  clearTimeout(timeout);
}
//# sourceMappingURL=log.js.map
