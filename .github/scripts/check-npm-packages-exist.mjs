#!/usr/bin/env node

// Verifies that every non-private workspace package already exists on npm.
//
// npm-publish.yml publishes with npm trusted publishing (OIDC) and has no token
// fallback. npm only allows a trusted publisher on a package that already
// exists, so `pnpm publish -r` fails mid-release (E404 PUT /
// ERR_PNPM_AUTH_TOKEN_EXCHANGE) on any brand-new package — after earlier
// packages have already been published. This check exists to surface that
// before a publish starts, never during one.
//
// Usage:
//   node check-npm-packages-exist.mjs [--since <git-ref>] [--registry <url>]
//                                     [--retry-404 <ms>] [--pnpm-filter <filter>]
//
// Exit codes: 0 = all publishable packages exist on npm
//             1 = packages missing from npm (publish would fail)
//             2 = could not verify (registry unreachable / persistent errors)

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const TRANSIENT_RETRIES = 3;
const RETRY_404_POLL_MS = 15_000;
const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENCY = 8;

function parseArgs(argv) {
  const options = { registry: DEFAULT_REGISTRY, retry404: 0, since: undefined, pnpmFilter: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--since') options.since = argv[++i];
    else if (arg === '--registry') options.registry = argv[++i].replace(/\/+$/, '');
    else if (arg === '--retry-404') options.retry404 = Number(argv[++i]);
    else if (arg === '--pnpm-filter') options.pnpmFilter = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node check-npm-packages-exist.mjs [--since <git-ref>] [--registry <url>] [--retry-404 <ms>] [--pnpm-filter <filter>]',
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (Number.isNaN(options.retry404) || options.retry404 < 0) {
    console.error(`Invalid --retry-404 value: ${options.retry404}`);
    process.exit(2);
  }
  return options;
}

// Same workspace discovery the publish workflow itself uses (npm-publish.yml).
function discoverPublishablePackages(pnpmFilter) {
  const args = ['m', 'ls', '--depth', '-1', '--json'];
  if (pnpmFilter) args.push('--filter', pnpmFilter);
  const output = execFileSync('pnpm', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const packages = [];
  for (const pkg of JSON.parse(output)) {
    if (!pkg.name || !pkg.path) continue;
    const manifest = JSON.parse(readFileSync(path.join(pkg.path, 'package.json'), 'utf8'));
    if (manifest.private) continue;
    packages.push({ name: pkg.name, version: manifest.version, directory: pkg.path });
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

// Packages whose package.json changed between <ref> and HEAD (merge-base diff):
// catches newly added packages and private→public promotions alike.
function changedPackageDirectories(since) {
  const output = execFileSync('git', ['diff', '--name-only', `${since}...HEAD`, '--', '**/package.json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return new Set(
    output
      .split('\n')
      .filter(Boolean)
      .map(file => path.resolve(path.dirname(file))),
  );
}

async function fetchStatus(registry, name) {
  const url = `${registry}/${name.replace('/', '%2f')}`;
  for (let attempt = 1; attempt <= TRANSIENT_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      // Consume the body so the socket is released.
      await response.arrayBuffer();
      if (response.status === 200) return 200;
      if (response.status === 404) return 404;
      // 429 / 5xx / anything else: transient, retry.
    } catch {
      // Network error / timeout: transient, retry.
    }
    if (attempt < TRANSIENT_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  return undefined;
}

async function packageExists(registry, name, retry404Ms) {
  const deadline = Date.now() + retry404Ms;
  const pollMs = Math.min(RETRY_404_POLL_MS, Math.max(100, Math.floor(retry404Ms / 5)));
  for (;;) {
    const status = await fetchStatus(registry, name);
    if (status === 200) return { exists: true };
    if (status === 404 && Date.now() + pollMs <= deadline) {
      await new Promise(resolve => setTimeout(resolve, pollMs));
      continue;
    }
    if (status === 404) return { exists: false };
    return { exists: undefined };
  }
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

function printRecoveryInstructions(pkg) {
  console.error(`✘ ${pkg.name} (${path.relative(process.cwd(), pkg.directory)}) has never been published to npm.`);
  console.error('');
  console.error('  npm-publish.yml publishes with npm trusted publishing (OIDC) and has no');
  console.error('  token fallback. npm only allows a trusted publisher on a package that');
  console.error('  already exists, so the publish will fail mid-release (E404 PUT /');
  console.error('  ERR_PNPM_AUTH_TOKEN_EXCHANGE) after earlier packages have gone out.');
  console.error('');
  console.error('  An npm org admin must reserve the name once with an empty 0.0.0 placeholder');
  console.error('  (no code from any branch is published) and enable trusted publishing.');
  console.error('  After `npm login`, from a checkout of mastra-ai/mastra that contains the package:');
  console.error(`    node scripts/npm-placeholder-publish.mjs ${pkg.name}`);
  console.error('  then re-run this check. CI publishes the first real version.');
  console.error('  If the package should not be published yet, mark it "private": true instead.');
  console.error('');
}

const options = parseArgs(process.argv.slice(2));

let packages = discoverPublishablePackages(options.pnpmFilter);

if (options.since) {
  const changed = changedPackageDirectories(options.since);
  packages = packages.filter(pkg => changed.has(pkg.directory));
  console.log(`--since ${options.since}: ${packages.length} publishable package(s) with changed package.json`);
}

if (packages.length === 0) {
  console.log('No publishable packages to check.');
  process.exit(0);
}

console.log(`Checking ${packages.length} publishable package(s) against ${options.registry}...`);

const results = await mapWithConcurrency(packages, CONCURRENCY, async pkg => ({
  pkg,
  ...(await packageExists(options.registry, pkg.name, options.retry404)),
}));

const missing = results.filter(result => result.exists === false);
const unverifiable = results.filter(result => result.exists === undefined);

for (const { pkg } of missing) {
  printRecoveryInstructions(pkg);
}

if (missing.length > 0) {
  console.error(
    `${missing.length} package(s) have never been published to npm: ${missing.map(({ pkg }) => pkg.name).join(', ')}`,
  );
  process.exit(1);
}

if (unverifiable.length > 0) {
  console.error(
    `Could not verify ${unverifiable.length} package(s) against ${options.registry} (registry errors): ${unverifiable.map(({ pkg }) => pkg.name).join(', ')}`,
  );
  process.exit(2);
}

console.log(`All ${packages.length} publishable package(s) exist on npm.`);
