/**
 * `mastracode features` — see and install the optional features that are installed on first use.
 *
 *   mastracode features                    list each feature, its pinned packages and where it is installed
 *   mastracode features install --all      install every feature now (Docker images, offline machines, CI caches)
 *   mastracode features install <id>...    install the named features now
 *   mastracode features prune              remove features installed for other Mastra Code versions
 */

import { FEATURES, isFeatureId } from './catalog.js';
import type { FeatureId } from './catalog.js';
import { isFeatureNotInstalledError } from './events.js';
import { getFeaturesRoot, installFeatureNow, listFeatures, pruneFeatureVersions } from './load.js';

const USAGE = `Usage: mastracode features [list | install (--all | <feature>...) | prune]

Optional features are installed the first time they are used. Use this command
to install them ahead of time, for example in a Docker image or on a machine
that will be offline.

Features:
${Object.values(FEATURES)
  .map(feature => `  ${feature.id.padEnd(12)} ${feature.label} (about ${feature.approxSizeMb} MB)`)
  .join('\n')}

Environment:
  MASTRACODE_FEATURE_INSTALL=never   never install on first use; report the feature as unavailable
  MASTRACODE_FEATURES_DIR=<path>     where features are installed`;

type Output = { write: (chunk: string) => unknown };

export async function runFeaturesCommand(
  args: string[],
  { stdout = process.stdout, stderr = process.stderr }: { stdout?: Output; stderr?: Output } = {},
): Promise<number> {
  const [sub = 'list', ...rest] = args;
  const say = (line: string) => stdout.write(`${line}\n`);

  if (sub === '--help' || sub === '-h' || sub === 'help') {
    say(USAGE);
    return 0;
  }

  if (sub === 'list') {
    say(`Features directory: ${getFeaturesRoot()}`);
    for (const status of await listFeatures()) {
      const packages = Object.entries(status.packages)
        .map(([name, version]) => `${name}@${version}`)
        .join(', ');
      const state =
        status.state === 'host'
          ? 'installed with mastracode'
          : status.state === 'features-dir'
            ? 'installed'
            : 'not installed (installs on first use)';
      say(`${status.id.padEnd(12)} ${state}`);
      say(`${''.padEnd(12)} ${status.label}; ${packages}`);
      say(`${''.padEnd(12)} ${status.path}`);
      if (status.lastFailure) {
        say(`${''.padEnd(12)} last install failed ${status.lastFailure.failedAt}: ${status.lastFailure.message}`);
      }
    }
    return 0;
  }

  if (sub === 'install') {
    const ids: FeatureId[] = rest.includes('--all') ? (Object.keys(FEATURES) as FeatureId[]) : [];
    for (const arg of rest.filter(arg => arg !== '--all')) {
      if (!isFeatureId(arg)) {
        stderr.write(`Unknown feature "${arg}". Known features: ${Object.keys(FEATURES).join(', ')}\n`);
        return 1;
      }
      ids.push(arg);
    }
    if (ids.length === 0) {
      stderr.write(`${USAGE}\n`);
      return 1;
    }
    let failed = false;
    for (const id of ids) {
      const feature = FEATURES[id];
      say(`Installing ${feature.label} (about ${feature.approxSizeMb} MB)…`);
      const startedAt = Date.now();
      try {
        const dir = await installFeatureNow(id);
        say(`Installed ${id} in ${((Date.now() - startedAt) / 1000).toFixed(1)} s: ${dir}`);
      } catch (error) {
        failed = true;
        if (isFeatureNotInstalledError(error)) {
          stderr.write(`Could not install ${id}: ${error.message}\n`);
          if (error.logPath) stderr.write(`npm output: ${error.logPath}\n`);
        } else {
          stderr.write(`Could not install ${id}: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
    }
    return failed ? 1 : 0;
  }

  if (sub === 'prune') {
    const removed = pruneFeatureVersions({ keepPrevious: 0 });
    say(removed.length === 0 ? 'Nothing to remove.' : removed.map(dir => `Removed ${dir}`).join('\n'));
    return 0;
  }

  stderr.write(`${USAGE}\n`);
  return 1;
}
