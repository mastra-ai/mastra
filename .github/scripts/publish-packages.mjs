#!/usr/bin/env node

// Publishes every non-private workspace package whose version is not on npm
// yet, several at a time.
//
// `pnpm publish -r` publishes one package at a time. Each publish is mostly
// waiting on npm (OIDC token exchange, upload, provenance signing), so a
// 158-package stable release spent ~21 minutes in that loop. This runs the
// same `pnpm publish` per package, in parallel, but keeps dependency order:
// a package is only published after every workspace package it depends on at
// runtime (dependencies, optionalDependencies, peerDependencies) is on npm,
// so nobody can install a version whose dependencies don't exist yet.
//
// Packages already on the registry at their current version are skipped, so
// re-running after a partial failure publishes only what's left — the same
// behavior `pnpm publish -r` has. A failed publish is retried, and an attempt
// that hangs is killed after PUBLISH_TIMEOUT_MS (default 10 minutes).
//
// Provenance signing can fail on its own: the sigstore transparency log
// sometimes answers 409 "an equivalent entry already exists" for minutes at a
// time. After such a failure the registry is polled for up to
// PUBLISH_REGISTRY_LAG_MS (default 30s) in case the version landed anyway, and
// the publish is retried more times with a longer backoff (30s up to 5 minutes).
//
// If a package still fails, every package that doesn't depend on it (directly
// or through another package) is still published; the ones that do are left
// out, and the script exits 1 at the end with a summary. Re-running publishes
// what is left.
//
// Usage:
//   node publish-packages.mjs [--tag <dist-tag>] [--concurrency <n>] [--registry <url>]
//                             [--pnpm-filter-prod <filter>]... [--dry-run]
//
// --pnpm-filter-prod limits the release to the packages pnpm selects with
// `--filter-prod` (for example '@mastra/playground-ui...' for a package and
// its production dependencies). --dry-run runs every `pnpm publish` with
// --dry-run: packages are packed and checked, nothing is uploaded.
//
// Lifecycle scripts (prepack etc.) and env such as NPM_CONFIG_PROVENANCE
// apply exactly as they do for `pnpm publish -r`.

import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const DEFAULT_CONCURRENCY = 8;
const PUBLISH_ATTEMPTS = 3;
const SIGNING_PUBLISH_ATTEMPTS = 6;
const RETRY_DELAY_MS = Number(process.env.PUBLISH_RETRY_DELAY_MS ?? 15_000);
// Waits after each failed attempt, in RETRY_DELAY_MS units: 15s, 30s for an
// ordinary failure; 30s, 1m, 2m, 4m, 5m for a provenance-signing failure.
const RETRY_STEPS = [1, 2];
const SIGNING_RETRY_STEPS = [2, 4, 8, 16, 20];
const REGISTRY_LAG_MS = Number(process.env.PUBLISH_REGISTRY_LAG_MS ?? 30_000);
const REGISTRY_POLL_MS = 2_000;
const PUBLISH_TIMEOUT_MS = Number(process.env.PUBLISH_TIMEOUT_MS ?? 10 * 60_000);
const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 15_000;

function parseArgs(argv) {
  const options = {
    tag: undefined,
    concurrency: DEFAULT_CONCURRENCY,
    registry: undefined,
    pnpmFilters: [],
    dryRun: false,
  };
  const value = i => {
    if (argv[i] === undefined || argv[i].startsWith('--')) {
      console.error(`Missing value for ${argv[i - 1]}`);
      process.exit(2);
    }
    return argv[i];
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--tag') options.tag = value(++i);
    else if (arg === '--concurrency') options.concurrency = Number(value(++i));
    else if (arg === '--registry') options.registry = value(++i).replace(/\/+$/, '');
    else if (arg === '--pnpm-filter-prod') options.pnpmFilters.push('--filter-prod', value(++i));
    else if (arg === '--dry-run') options.dryRun = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    console.error(`Invalid --concurrency value: ${options.concurrency}`);
    process.exit(2);
  }
  return options;
}

function discoverPublishablePackages(pnpmFilters) {
  const output = execFileSync('pnpm', ['m', 'ls', '--depth', '-1', '--json', ...pnpmFilters], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const packages = new Map();
  for (const pkg of JSON.parse(output)) {
    if (!pkg.name || !pkg.path) continue;
    const manifest = JSON.parse(readFileSync(path.join(pkg.path, 'package.json'), 'utf8'));
    if (manifest.private) continue;
    packages.set(manifest.name, { name: manifest.name, version: manifest.version, directory: pkg.path, manifest });
  }
  return packages;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// npm signs the provenance statement, and records it in the sigstore
// transparency log (Rekor), before it uploads anything.
const isSigningFailure = output => /TLOG_|tlog entry|transparency log|sigstore|fulcio|rekor|provenance/i.test(output);
const isTransient = status => status === 408 || status === 429 || status >= 500;

async function isPublished(registry, { name, version }) {
  const url = `${registry}/${name.replaceAll('/', '%2f')}/${encodeURIComponent(version)}`;
  for (let attempt = 1; ; attempt++) {
    let status;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      await response.body?.cancel();
      status = response.status;
      if (status === 200) return true;
      if (status === 404) return false;
    } catch (error) {
      status = error.message;
    }
    if ((typeof status === 'number' && !isTransient(status)) || attempt === FETCH_ATTEMPTS) {
      throw new Error(`Could not check ${name}@${version} on ${registry}: ${status}`);
    }
    await sleep(1000 * attempt);
  }
}

async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// The packages still to publish that this one needs at runtime.
const runtimeDeps = ({ manifest }, pending) =>
  Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies }).filter(
    dep => dep !== manifest.name && pending.has(dep),
  );

// Groups packages into levels: every package's workspace runtime
// dependencies are in an earlier level (or already published).
function dependencyLevels(pending) {
  const remaining = new Map([...pending.values()].map(pkg => [pkg.name, runtimeDeps(pkg, pending)]));
  const done = new Set();
  const levels = [];
  while (remaining.size > 0) {
    const level = [...remaining].filter(([, deps]) => deps.every(dep => done.has(dep))).map(([name]) => name);
    if (level.length === 0) {
      throw new Error(`Dependency cycle between packages: ${[...remaining.keys()].join(', ')}`);
    }
    for (const name of level) {
      remaining.delete(name);
      done.add(name);
    }
    levels.push(level.sort().map(name => pending.get(name)));
  }
  return levels;
}

function runPublish(pkg, options) {
  const args = ['publish', '--access', 'public', '--no-git-checks'];
  if (options.tag) args.push('--tag', options.tag);
  if (options.registry) args.push('--registry', options.registry);
  if (options.dryRun) args.push('--dry-run');
  return new Promise(resolve => {
    // Its own process group, so a timeout kills pnpm and everything it started
    // (lifecycle scripts, the upload) instead of leaving them running.
    const child = spawn('pnpm', args, { cwd: pkg.directory, env: process.env, detached: true });
    let output = '';
    const timer = setTimeout(() => {
      output += `\nTimed out after ${PUBLISH_TIMEOUT_MS / 1000}s; killed.\n`;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // Already exited between the timer firing and the kill.
      }
    }, PUBLISH_TIMEOUT_MS);
    child.stdout.setEncoding('utf8').on('data', chunk => (output += chunk));
    child.stderr.setEncoding('utf8').on('data', chunk => (output += chunk));
    child.on('error', error => {
      clearTimeout(timer);
      resolve({ code: 1, output: `${output}${error.message}\n` });
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output });
    });
  });
}

// Whether the version is on the registry, polling for up to `lagMs` because a
// version npm just accepted can take a while to show.
async function appearsOnRegistry(registry, pkg, lagMs) {
  const deadline = Date.now() + lagMs;
  for (;;) {
    if (await isPublished(registry, pkg).catch(() => false)) return true;
    if (Date.now() + REGISTRY_POLL_MS > deadline) return false;
    await sleep(REGISTRY_POLL_MS);
  }
}

async function publishPackage(pkg, options, registry) {
  const id = `${pkg.name}@${pkg.version}`;
  const started = Date.now();
  // Once a signing failure has been seen, the package gets the signing budget and
  // backoff for the rest of its attempts, whatever the later failures are.
  let signingSeen = false;
  let attempts = PUBLISH_ATTEMPTS;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { code, output } = await runPublish(pkg, options);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (code === 0) {
      console.log(
        `::group::${options.dryRun ? 'Dry run of' : 'Published'} ${id} (${seconds}s)\n${output.trimEnd()}\n::endgroup::`,
      );
      return true;
    }
    const signing = isSigningFailure(output);
    if (signing && !signingSeen) {
      signingSeen = true;
      attempts = SIGNING_PUBLISH_ATTEMPTS;
    }
    // The publish can reach npm and still exit non-zero (e.g. a dropped
    // connection after the upload). The registry is the source of truth.
    if (await appearsOnRegistry(registry, pkg, signing ? REGISTRY_LAG_MS : 0)) {
      console.log(
        `::group::Published ${id} (${seconds}s, reported a failure but is on the registry)\n${output.trimEnd()}\n::endgroup::`,
      );
      return true;
    }
    if (attempt < attempts) {
      const delay = RETRY_DELAY_MS * (signingSeen ? SIGNING_RETRY_STEPS : RETRY_STEPS)[attempt - 1];
      const why = signing ? ', provenance signing' : '';
      console.log(
        `::group::Retrying ${id} (attempt ${attempt} of ${attempts} failed${why}; next in ${delay / 1000}s)\n${output.trimEnd()}\n::endgroup::`,
      );
      await sleep(delay);
    } else {
      console.log(`::error::Failed to publish ${id} after ${attempts} attempts`);
      console.log(output.trimEnd());
    }
  }
  return false;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const registry = options.registry ?? DEFAULT_REGISTRY;
  const packages = discoverPublishablePackages(options.pnpmFilters);

  const published = await mapConcurrent([...packages.values()], 16, pkg => isPublished(registry, pkg));
  const pending = new Map([...packages.values()].filter((_, i) => !published[i]).map(pkg => [pkg.name, pkg]));
  if (pending.size === 0) {
    console.log('Every publishable package is already on the registry; nothing to publish.');
    return;
  }

  const levels = dependencyLevels(pending);
  console.log(
    `Publishing ${pending.size} package(s) in ${levels.length} dependency level(s), ${options.concurrency} at a time` +
      (options.tag ? ` with tag "${options.tag}"` : '') +
      (options.dryRun ? ' (dry run, nothing is uploaded)' : ''),
  );

  const started = Date.now();
  const failed = [];
  // Package name → the failed package it needs, directly or through another.
  const blockedBy = new Map();
  for (const level of levels) {
    const ready = [];
    for (const pkg of level) {
      const cause = runtimeDeps(pkg, pending)
        .map(dep => blockedBy.get(dep) ?? (failed.includes(pending.get(dep)) ? dep : undefined))
        .find(Boolean);
      if (cause) blockedBy.set(pkg.name, cause);
      else ready.push(pkg);
    }
    const results = await mapConcurrent(ready, options.concurrency, pkg => publishPackage(pkg, options, registry));
    failed.push(...ready.filter((_, i) => !results[i]));
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  if (failed.length === 0) {
    console.log(`${options.dryRun ? 'Dry run of' : 'Published'} ${pending.size} package(s) in ${seconds}s`);
    return;
  }
  const publishedCount = pending.size - failed.length - blockedBy.size;
  console.log(`::error::${failed.length} package(s) failed to publish; ${blockedBy.size} more depend on them`);
  console.log(`Published ${publishedCount} of ${pending.size} package(s) in ${seconds}s`);
  console.log(`Failed: ${failed.map(pkg => `${pkg.name}@${pkg.version}`).join(', ')}`);
  if (blockedBy.size > 0) {
    const blocked = [...blockedBy].map(([name, cause]) => `${name}@${pending.get(name).version} (needs ${cause})`);
    console.log(`Not published because a dependency failed: ${blocked.join(', ')}`);
  }
  console.log('Re-run the publish to publish the remaining packages; already published versions are skipped.');
  process.exit(1);
}

main().catch(error => {
  console.error(error.message);
  process.exit(2);
});
