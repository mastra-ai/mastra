import { format } from "util";
import chalk from "chalk";
import ProgressBar, {
  ProgressBarInstance,
  ProgressBarOptions,
} from "../vendor/progress/index.js";
import ora, { Ora } from "ora";

let spinner: Ora | null = null;

// console.error before it started being red by default in Node v20
function logToStderr(...args: unknown[]) {
  process.stderr.write(`${format(...args)}\n`);
}

// Handles clearing spinner so that it doesn't get messed up
export function logError(message: string) {
  spinner?.clear();
  logToStderr(message);
}

// Handles clearing spinner so that it doesn't get messed up
export function logWarning(...logged: any) {
  spinner?.clear();
  logToStderr(...logged);
}

// Handles clearing spinner so that it doesn't get messed up
export function logMessage(...logged: any) {
  spinner?.clear();
  logToStderr(...logged);
}

// For the rare case writing output to stdout. Status and error messages
// (logMessage, logWarning, etc.) should be written to stderr.
export function logOutput(...logged: any) {
  spinner?.clear();
  // the one spot where we can console.log
  // eslint-disable-next-line no-console
  console.log(...logged);
}

export function logVerbose(...logged: any) {
  if (process.env.CONVEX_VERBOSE) {
    logMessage(`[verbose] ${new Date().toISOString()}`, ...logged);
  }
}

/**
 * Returns a ProgressBar instance, and also handles clearing the spinner if necessary.
 *
 * The caller is responsible for calling `progressBar.tick()` and terminating the `progressBar`
 * when it's done.
 */
export function startLogProgress(
  format: string,
  progressBarOptions: ProgressBarOptions,
): ProgressBarInstance {
  spinner?.clear();
  return new ProgressBar(format, progressBarOptions);
}

// Start a spinner.
// To change its message use changeSpinner.
// To print warnings/errors while it's running use logError or logWarning.
// To stop it due to an error use logFailure.
// To stop it due to success use logFinishedStep.
export function showSpinner(message: string) {
  spinner?.stop();
  spinner = ora({
    // Add newline to prevent clobbering when a message
    // we can't pipe through `logMessage` et al gets printed
    text: message + "\n",
    stream: process.stderr,
    // hideCursor: true doesn't work with `tsx`.
    // see https://github.com/tapjs/signal-exit/issues/49#issuecomment-1459408082
    // See CX-6822 for an issue to bring back cursor hiding, probably by upgrading libraries.
    hideCursor: process.env.CONVEX_RUNNING_LIVE_IN_MONOREPO ? false : true,
  }).start();
}

export function changeSpinner(message: string) {
  if (spinner) {
    // Add newline to prevent clobbering
    spinner.text = message + "\n";
  } else {
    logToStderr(message);
  }
}

export function failExistingSpinner() {
  spinner?.fail();
  spinner = null;
}

export function logFailure(message: string) {
  if (spinner) {
    spinner.fail(message);
    spinner = null;
  } else {
    logToStderr(`${chalk.red(`✖`)} ${message}`);
  }
}

// Stops and removes spinner if one is active
export function logFinishedStep(message: string) {
  if (spinner) {
    spinner.succeed(message);
    spinner = null;
  } else {
    logToStderr(`${chalk.green(`✔`)} ${message}`);
  }
}

export function stopSpinner() {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
}

// Only shows the spinner if the async `fn` takes longer than `delayMs`
export async function showSpinnerIfSlow(
  message: string,
  delayMs: number,
  fn: () => Promise<any>,
) {
  const timeout = setTimeout(() => {
    showSpinner(message);
  }, delayMs);
  await fn();
  clearTimeout(timeout);
}
