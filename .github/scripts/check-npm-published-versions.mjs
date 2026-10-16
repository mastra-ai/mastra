#!/usr/bin/env node

// Runs after `pnpm publish -r` in npm-publish.yml and confirms that every
// version pnpm reported as published is really live on the registry.
//
// npm can accept a publish PUT and only *stage* the version (it then waits for
// a maintainer to approve it), and pnpm still prints
// `✅ Published package <name>@<version>`. The rest of the release carries on
// as if it shipped, and every re-run fails on that package with
// `E409 ... Cannot publish over previously staged version`, which does not say
// that someone has to approve it. Stable 1.78.0 (run 38809638764, Oct 2026)
// lost two re-runs that way.
//
// Reads the publish output (a file, saved with tee) and checks:
// - every `✅ Published package <name>@<version>` line: GET
//   <registry>/<name>/<version> must be 200. A 404 is re-checked until one
//   shared --retry-missing deadline (the registry lags a freshly published
//   version), then reported as staged / not published.
// - every `E409 ... PUT <registry>/<name> ... previously staged version "<v>"`
//   line: reported as staged straight away, unless that version is live.
//
// Usage:
//   node check-npm-published-versions.mjs <publish-log> [--registry <url>] [--retry-missing <ms>]
//
// Exit codes: 0 = every reported version is live (or nothing was published)
//             1 = versions staged or missing: a maintainer must approve them
//             2 = could not verify (registry errors) or bad arguments

import { readFileSync } from 'node:fs';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const TRANSIENT_RETRIES = 3;
const POLL_MS = 15_000;
const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENCY = 8;

function parseArgs(argv) {
  const options = { log: undefined, registry: DEFAULT_REGISTRY, retryMissing: 0 };
  const value = i => {
    if (argv[i] === undefined || argv[i].startsWith('--')) {
      console.error(`Missing value for ${argv[i - 1]}`);
      process.exit(2);
    }
    return argv[i];
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--registry') options.registry = value(++i).replace(/\/+$/, '');
    else if (arg === '--retry-missing') options.retryMissing = Number(value(++i));
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node check-npm-published-versions.mjs <publish-log> [--registry <url>] [--retry-missing <ms>]',
      );
      process.exit(0);
    } else if (arg.startsWith('--') || options.log !== undefined) {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    } else options.log = arg;
  }
  if (options.log === undefined) {
    console.error('Missing <publish-log> argument');
    process.exit(2);
  }
  if (Number.isNaN(options.retryMissing) || options.retryMissing < 0) {
    console.error(`Invalid --retry-missing value: ${options.retryMissing}`);
    process.exit(2);
  }
  return options;
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
const PUBLISHED = /✅ Published package (@?[^@\s]+)@(\S+)/;
const STAGED_CONFLICT = /E409\b.*PUT \S+\/(@[^/\s]+%2[fF][^/\s]+|[^/\s@]+)\s.*previously staged version "([^"]+)"/;

export function parsePublishLog(text) {
  const published = new Map();
  const staged = new Map();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(ANSI, '');
    let match = PUBLISHED.exec(line);
    if (match) {
      published.set(`${match[1]}@${match[2]}`, { name: match[1], version: match[2] });
      continue;
    }
    match = STAGED_CONFLICT.exec(line);
    if (match) {
      const name = decodeURIComponent(match[1]);
      staged.set(`${name}@${match[2]}`, { name, version: match[2] });
    }
  }
  return { published: [...published.values()], staged: [...staged.values()] };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// 200: live. 404: not (yet) live. undefined: registry errors.
async function versionStatus(registry, { name, version }) {
  for (let attempt = 1; attempt <= TRANSIENT_RETRIES; attempt++) {
    try {
      const response = await fetch(`${registry}/${name.replaceAll('/', '%2f')}/${encodeURIComponent(version)}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      // Consume the body so the socket is released.
      await response.arrayBuffer();
      if (response.status === 200 || response.status === 404) return response.status;
    } catch {
      // Network error / timeout: transient, retry.
    }
    if (attempt < TRANSIENT_RETRIES) await sleep(attempt * 1000);
  }
  return undefined;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const current = index++;
        results[current] = await fn(items[current]);
      }
    }),
  );
  return results;
}

// Checks every version once, then re-checks only the 404s together until one
// shared deadline, so a run with staged versions fails after about one window.
async function checkAll(registry, versions, retryMs) {
  const deadline = Date.now() + retryMs;
  const pollMs = Math.min(POLL_MS, Math.max(100, Math.floor(retryMs / 5)));
  const status = new Map();
  let pending = versions;
  for (;;) {
    const statuses = await mapWithConcurrency(pending, CONCURRENCY, entry => versionStatus(registry, entry));
    pending.forEach((entry, i) => status.set(entry, statuses[i]));
    pending = pending.filter(entry => status.get(entry) === 404);
    if (pending.length === 0 || Date.now() + pollMs > deadline) break;
    await sleep(pollMs);
  }
  return status;
}

// stdout/stderr writes to a pipe are asynchronous on Linux, so process.exit()
// straight after many lines can drop the tail of the output.
async function exit(code) {
  await Promise.all([process.stdout, process.stderr].map(stream => new Promise(resolve => stream.write('', resolve))));
  process.exit(code);
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMain) {
  const options = parseArgs(process.argv.slice(2));
  const { published, staged } = parsePublishLog(readFileSync(options.log, 'utf8'));
  const stagedKeys = new Set(staged.map(({ name, version }) => `${name}@${version}`));
  const toCheck = published.filter(({ name, version }) => !stagedKeys.has(`${name}@${version}`));

  if (toCheck.length === 0 && staged.length === 0) {
    console.log('pnpm reported no published versions; nothing to check.');
    await exit(0);
  }

  console.log(
    `Checking ${toCheck.length} version(s) pnpm reported as published${staged.length ? ` and ${staged.length} npm refused as previously staged` : ''} against ${options.registry}...`,
  );

  // Staged-conflict versions get one look (they may have been approved since);
  // the reported-published ones get the lag window.
  const [publishedStatus, stagedStatus] = await Promise.all([
    checkAll(options.registry, toCheck, options.retryMissing),
    checkAll(options.registry, staged, 0),
  ]);

  const notLive = [
    ...toCheck.filter(entry => publishedStatus.get(entry) === 404),
    ...staged.filter(entry => stagedStatus.get(entry) !== 200),
  ];
  const unverifiable = toCheck.filter(entry => publishedStatus.get(entry) === undefined);

  if (notLive.length > 0) {
    for (const { name, version } of notLive) {
      console.log(
        `::error title=Staged, not published::${name}@${version} is not live on npm. npm staged it for approval instead of publishing it.`,
      );
    }
    console.error('');
    console.error(`${notLive.length} version(s) are staged on npm, not published:`);
    for (const { name, version } of notLive) console.error(`  ✘ ${name}@${version}`);
    console.error('');
    console.error('  npm accepted these uploads but is holding them for a maintainer to approve,');
    console.error('  even though pnpm printed "Published". Re-running this workflow will not');
    console.error('  publish them: npm refuses with E409 "Cannot publish over previously staged');
    console.error('  version" until each staged version is approved or rejected.');
    console.error('');
    console.error('  An npm maintainer of each package, after `npm login`:');
    for (const { name } of notLive) console.error(`    npx npm@^11.15.0 stage list ${name}`);
    console.error('    npx npm@^11.15.0 stage approve <stage-id>   # for the version listed above');
    console.error('  then re-run this workflow to publish the remaining packages.');
    console.error('  To find out why npm staged it, check the trusted publisher with');
    console.error('  `npx npm@^11.15.0 trust list <package>` (it must allow publishing, not only');
    console.error('  staging) or run `node scripts/npm-placeholder-publish.mjs <package> --dry-run`.');
    await exit(1);
  }

  if (unverifiable.length > 0) {
    console.error(
      `Could not verify ${unverifiable.length} version(s) against ${options.registry} (registry errors): ${unverifiable.map(({ name, version }) => `${name}@${version}`).join(', ')}`,
    );
    await exit(2);
  }

  console.log(`All ${toCheck.length + staged.length} reported version(s) are live on npm.`);
  await exit(0);
}
