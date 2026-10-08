import {
  detectPackageManager,
  fetchLatestVersion,
  isNewerVersion,
  performUpdate,
} from '@mastra/code-sdk/utils/update-check';

const UPDATE_COMMANDS = new Set(['update', 'upgrade']);
const USAGE =
  'Usage: mastracode update\n\nInstall the latest version of Mastra Code. `mastracode upgrade` is an alias.';

/** Arguments after `mastracode update`/`mastracode upgrade`, or undefined for any other invocation. */
export function getUpdateCommandArgs(argv: string[]): string[] | undefined {
  return UPDATE_COMMANDS.has(argv[2] ?? '') ? argv.slice(3) : undefined;
}

interface UpdateCommandOptions {
  args?: string[];
  output?: NodeJS.WritableStream;
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
  currentVersion,
}: UpdateCommandOptions): Promise<number> {
  const say = (line: string) => output.write(`${line}\n`);

  if (args.includes('--help') || args.includes('-h')) {
    say(USAGE);
    return 0;
  }
  if (args.length > 0) {
    say(USAGE);
    return 1;
  }

  say('Checking for updates…');
  const latestVersion = await fetchLatestVersion();
  if (!latestVersion) {
    say('Could not reach the npm registry. Check your network connection.');
    return 1;
  }
  if (!isNewerVersion(currentVersion, latestVersion)) {
    say(`You are already on the latest version (v${currentVersion}).`);
    return 0;
  }

  say(`Updating Mastra Code from v${currentVersion} to v${latestVersion}…`);
  const outcome = await performUpdate(await detectPackageManager(), latestVersion);
  if (outcome.status === 'updated') {
    say(`Updated Mastra Code to v${latestVersion}.`);
    return 0;
  }
  say(outcome.message);
  return 1;
}
