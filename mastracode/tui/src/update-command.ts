import {
  describeUpdate,
  detectPackageManager,
  fetchLatestVersion,
  isNewerVersion,
  performUpdate,
} from '@mastra/code-sdk/utils/update-check';
import { Chalk } from 'chalk';
import {
  formatInstallingLabel,
  formatRegistryError,
  formatUpdateHeader,
  formatUpdateOutcome,
  formatUpToDate,
} from './update-output.js';
import type { UpdateStyle } from './update-output.js';

const UPDATE_COMMANDS = new Set(['update', 'upgrade']);
const USAGE =
  'Usage: mastracode update\n\nInstall the latest version of Mastra Code. `mastracode upgrade` is an alias.';
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

type OutputStream = NodeJS.WritableStream & { isTTY?: boolean };

/** Arguments after `mastracode update`/`mastracode upgrade`, or undefined for any other invocation. */
export function getUpdateCommandArgs(argv: string[]): string[] | undefined {
  return UPDATE_COMMANDS.has(argv[2] ?? '') ? argv.slice(3) : undefined;
}

/** Terminal colors, so the output reads well on light and dark terminals; none when the stream isn't a terminal. */
function styleFor(stream: OutputStream): UpdateStyle {
  const chalk = new Chalk(stream.isTTY && !process.env.NO_COLOR ? {} : { level: 0 });
  return { accent: chalk.green, muted: chalk.gray, error: chalk.red, warning: chalk.yellow, bold: chalk.bold };
}

/** Spin `label` on a terminal until stopped; elsewhere print it once (or not at all when `quiet`). */
function startSpinner(stream: OutputStream, style: UpdateStyle, label: string, { quiet = false } = {}): () => void {
  if (!stream.isTTY) {
    if (!quiet) stream.write(`${label}\n`);
    return () => {};
  }
  const started = Date.now();
  let frame = 0;
  const draw = () => {
    const seconds = Math.floor((Date.now() - started) / 1000);
    stream.write(`\r\x1b[2K${style.accent(SPINNER_FRAMES[frame]!)} ${label}  ${style.muted(`${seconds}s`)}`);
    frame = (frame + 1) % SPINNER_FRAMES.length;
  };
  draw();
  const timer = setInterval(draw, 80);
  return () => {
    clearInterval(timer);
    stream.write('\r\x1b[2K');
  };
}

interface UpdateCommandOptions {
  args?: string[];
  output?: OutputStream;
  /** Failures go here, so `mastracode update >/dev/null` still shows them. */
  errorOutput?: OutputStream;
  currentVersion: string;
}

/**
 * Update Mastra Code from the shell. Unlike `/update`, there's no confirmation:
 * running the command is the request. Exits 1 unless the running install is on
 * the latest version afterwards.
 */
export async function runUpdateCommand({
  args = [],
  output = process.stdout,
  errorOutput = process.stderr,
  currentVersion,
}: UpdateCommandOptions): Promise<number> {
  const style = styleFor(output);
  const errorStyle = styleFor(errorOutput);
  const say = (line: string) => output.write(`${line}\n`);
  const fail = (...lines: string[]) => {
    errorOutput.write(`${lines.join('\n')}\n`);
    return 1;
  };

  if (args.includes('--help') || args.includes('-h')) {
    say(USAGE);
    return 0;
  }
  if (args.length > 0) {
    return fail(`${errorStyle.error('✗')} Unexpected argument: ${errorStyle.bold(args[0]!)}`, '', USAGE);
  }

  const stopChecking = startSpinner(output, style, 'Checking for updates', { quiet: true });
  const latestVersion = await fetchLatestVersion();
  stopChecking();
  if (!latestVersion) {
    say(formatUpdateHeader(style, currentVersion));
    return fail(formatRegistryError(errorStyle));
  }
  if (!isNewerVersion(currentVersion, latestVersion)) {
    say(formatUpdateHeader(style, currentVersion));
    say(formatUpToDate(style));
    return 0;
  }

  say(formatUpdateHeader(style, currentVersion, latestVersion));
  const pm = await detectPackageManager();
  const stopInstalling = startSpinner(output, style, formatInstallingLabel(style, describeUpdate(pm, latestVersion)));
  const outcome = await performUpdate(pm, latestVersion);
  stopInstalling();
  if (outcome.status === 'updated') {
    say(formatUpdateOutcome(style, outcome, latestVersion).join('\n'));
    return 0;
  }
  return fail(...formatUpdateOutcome(errorStyle, outcome, latestVersion));
}
