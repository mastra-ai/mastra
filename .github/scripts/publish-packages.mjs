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
// behavior `pnpm publish -r` has. A failed publish is retried; if a package
// still fails, the packages that depend on it are not published and the
// script exits 1.
//
// Usage:
//   node publish-packages.mjs [--tag <dist-tag>] [--concurrency <n>] [--registry <url>]
//
// Lifecycle scripts (prepack etc.) and env such as NPM_CONFIG_PROVENANCE
// apply exactly as they do for `pnpm publish -r`.

import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const DEFAULT_CONCURRENCY = 8;
const PUBLISH_ATTEMPTS = 3;
const RETRY_DELAY_MS = Number(process.env.PUBLISH_RETRY_DELAY_MS ?? 15_000);
const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 15_000;

function parseArgs(argv) {
  const options = { tag: undefined, concurrency: DEFAULT_CONCURRENCY, registry: undefined };
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

function discoverPublishablePackages() {
  const output = execFileSync('pnpm', ['m', 'ls', '--depth', '-1', '--json'], {
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

// Groups packages into levels: every package's workspace runtime
// dependencies are in an earlier level (or already published).
function dependencyLevels(pending) {
  const runtimeDeps = ({ manifest }) =>
    Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies }).filter(
      dep => dep !== manifest.name && pending.has(dep),
    );
  const remaining = new Map([...pending.values()].map(pkg => [pkg.name, runtimeDeps(pkg)]));
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
  return new Promise(resolve => {
    const child = spawn('pnpm', args, { cwd: pkg.directory, env: process.env });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', chunk => (output += chunk));
    child.stderr.setEncoding('utf8').on('data', chunk => (output += chunk));
    child.on('error', error => resolve({ code: 1, output: `${output}${error.message}\n` }));
    child.on('close', code => resolve({ code: code ?? 1, output }));
  });
}

async function publishPackage(pkg, options, registry) {
  const id = `${pkg.name}@${pkg.version}`;
  const started = Date.now();
  for (let attempt = 1; attempt <= PUBLISH_ATTEMPTS; attempt++) {
    const { code, output } = await runPublish(pkg, options);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (code === 0) {
      console.log(`::group::Published ${id} (${seconds}s)\n${output.trimEnd()}\n::endgroup::`);
      return true;
    }
    // The publish can reach npm and still exit non-zero (e.g. a dropped
    // connection after the upload). The registry is the source of truth.
    if (await isPublished(registry, pkg).catch(() => false)) {
      console.log(
        `::group::Published ${id} (${seconds}s, reported a failure but is on the registry)\n${output.trimEnd()}\n::endgroup::`,
      );
      return true;
    }
    if (attempt < PUBLISH_ATTEMPTS) {
      console.log(
        `::group::Retrying ${id} (attempt ${attempt} of ${PUBLISH_ATTEMPTS} failed)\n${output.trimEnd()}\n::endgroup::`,
      );
      await sleep(RETRY_DELAY_MS * attempt);
    } else {
      console.log(`::error::Failed to publish ${id} after ${PUBLISH_ATTEMPTS} attempts`);
      console.log(output.trimEnd());
    }
  }
  return false;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const registry = options.registry ?? DEFAULT_REGISTRY;
  const packages = discoverPublishablePackages();

  const published = await mapConcurrent([...packages.values()], 16, pkg => isPublished(registry, pkg));
  const pending = new Map([...packages.values()].filter((_, i) => !published[i]).map(pkg => [pkg.name, pkg]));
  if (pending.size === 0) {
    console.log('Every publishable package is already on the registry; nothing to publish.');
    return;
  }

  const levels = dependencyLevels(pending);
  console.log(
    `Publishing ${pending.size} package(s) in ${levels.length} dependency level(s), ${options.concurrency} at a time` +
      (options.tag ? ` with tag "${options.tag}"` : ''),
  );

  const started = Date.now();
  for (const [index, level] of levels.entries()) {
    const results = await mapConcurrent(level, options.concurrency, pkg => publishPackage(pkg, options, registry));
    const failed = level.filter((_, i) => !results[i]);
    if (failed.length > 0) {
      const notAttempted = levels.slice(index + 1).flat();
      console.log(`::error::Publishing stopped: ${failed.length} package(s) failed`);
      console.log(`Failed: ${failed.map(pkg => `${pkg.name}@${pkg.version}`).join(', ')}`);
      if (notAttempted.length > 0) {
        console.log(
          `Not published because they come after a failed package: ${notAttempted.map(pkg => pkg.name).join(', ')}`,
        );
      }
      console.log('Re-run the publish to publish the remaining packages; already published versions are skipped.');
      process.exit(1);
    }
  }
  console.log(`Published ${pending.size} package(s) in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(2);
});
