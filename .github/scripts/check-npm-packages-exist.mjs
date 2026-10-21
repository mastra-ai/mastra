#!/usr/bin/env node

// Verifies that every non-private workspace package already exists on npm
// and, with --oidc, that npm grants this job a trusted-publishing token for it.
//
// npm-publish.yml publishes with npm trusted publishing (OIDC) and has no token
// fallback. npm only allows a trusted publisher on a package that already
// exists, so `pnpm publish -r` fails mid-release (E404 PUT /
// ERR_PNPM_AUTH_TOKEN_EXCHANGE) on any brand-new package — after earlier
// packages have already been published. The same happens to a package that
// exists but has no trusted publisher, or one for another repo or workflow.
// This check exists to surface that before a publish starts, never during one.
//
// --oidc (publish jobs only; needs `permissions: id-token: write`) performs,
// for every package, the same OIDC token exchange pnpm/npm perform at publish
// time: a GitHub OIDC token for audience `npm:<registry host>` is POSTed to
// <registry>/-/npm/v1/oidc/token/exchange/package/<name>. npm returns a
// short-lived token only if the package has a trusted publisher for this repo
// and workflow (and GitHub environment, if the publisher names one). That token
// is discarded unused and never printed. A granted token proves the exchange
// works, not that the publish PUT will be accepted: npm uses the same exchange
// for publish, stage publish and dist-tag, and the token's permissions can't
// be read anonymously, so a trusted publisher that allows only staged
// publishing (createStagedPackage, no createPackage) passes --oidc and fails
// at publish. scripts/npm-placeholder-publish.mjs checks those permissions
// when it configures or reads back trust.
// Without --oidc (PR checks: no secrets), a package that exists but has no
// version published through trusted publishing is reported as a warning only:
// a fresh placeholder looks like that until CI's first publish.
//
// Usage:
//   node check-npm-packages-exist.mjs [--since <git-ref>] [--registry <url>]
//                                     [--retry-404 <ms>] [--pnpm-filter <filter>]
//                                     [--oidc]
//
// Exit codes: 0 = all publishable packages exist on npm (and, with --oidc,
//                 npm granted this job a trusted-publishing token for each)
//             1 = packages missing from npm, or (--oidc) npm refused the
//                 token exchange for them (publish would fail)
//             2 = could not verify (registry or GitHub OIDC unreachable /
//                 persistent errors)

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const TRANSIENT_RETRIES = 3;
const RETRY_404_POLL_MS = 15_000;
const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENCY = 8;
const ID_TOKEN_ENV = ['ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN'];

function parseArgs(argv) {
  const options = { registry: DEFAULT_REGISTRY, retry404: 0, since: undefined, pnpmFilter: undefined, oidc: false };
  const value = i => {
    if (argv[i] === undefined || argv[i].startsWith('--')) {
      console.error(`Missing value for ${argv[i - 1]}`);
      process.exit(2);
    }
    return argv[i];
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--since') options.since = value(++i);
    else if (arg === '--registry') options.registry = value(++i).replace(/\/+$/, '');
    else if (arg === '--retry-404') options.retry404 = Number(value(++i));
    else if (arg === '--pnpm-filter') options.pnpmFilter = value(++i);
    else if (arg === '--oidc') options.oidc = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node check-npm-packages-exist.mjs [--since <git-ref>] [--registry <url>] [--retry-404 <ms>] [--pnpm-filter <filter>] [--oidc]',
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

const escapedName = name => name.replaceAll('/', '%2f');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// 408 / 429 / 5xx: the registry, not the package, is the problem.
const isTransient = status => status === 408 || status === 429 || status >= 500;

async function fetchPackument(registry, name) {
  for (let attempt = 1; attempt <= TRANSIENT_RETRIES; attempt++) {
    try {
      const response = await fetch(`${registry}/${escapedName(name)}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (response.status === 200) {
        const packument = await response.json();
        const versions = Object.values(packument.versions ?? {});
        return { status: 200, everTrustedPublished: versions.some(version => version?._npmUser?.trustedPublisher) };
      }
      // Consume the body so the socket is released.
      await response.arrayBuffer();
      if (response.status === 404) return { status: 404 };
      // 429 / 5xx / anything else: transient, retry.
    } catch {
      // Network error / timeout / truncated body: transient, retry.
    }
    if (attempt < TRANSIENT_RETRIES) await sleep(attempt * 1000);
  }
  return { status: undefined };
}

// Checks every package once, then re-checks only the definite "no"s
// (`retryable`) together until one shared --retry-404 deadline: an npm admin
// may have fixed them minutes ago. The deadline is shared, so a failing run
// takes about one retry window however many packages fail. With
// `failFastIfAllRetryable`, a first pass where every package (of several) is
// a "no" ends at once: that is a problem with the job, not the packages.
async function checkAll(packages, retryMs, check, { failFastIfAllRetryable = false } = {}) {
  const deadline = Date.now() + retryMs;
  const pollMs = Math.min(RETRY_404_POLL_MS, Math.max(100, Math.floor(retryMs / 5)));
  const results = new Map();
  let pending = packages;
  for (let pass = 1; ; pass++) {
    const passResults = await mapWithConcurrency(pending, CONCURRENCY, async pkg => ({ pkg, ...(await check(pkg)) }));
    for (const result of passResults) results.set(result.pkg, result);
    pending = passResults.filter(result => result.retryable).map(result => result.pkg);
    if (pending.length === 0 || Date.now() + pollMs > deadline) break;
    if (failFastIfAllRetryable && pass === 1 && packages.length > 1 && pending.length === packages.length) break;
    await sleep(pollMs);
  }
  return packages.map(pkg => results.get(pkg));
}

async function packageExists(registry, name) {
  const { status, everTrustedPublished } = await fetchPackument(registry, name);
  if (status === 200) return { exists: true, everTrustedPublished };
  if (status === 404) return { exists: false, retryable: true };
  return { exists: undefined };
}

// GitHub's OIDC token endpoint, exactly as pnpm and npm call it before a
// trusted publish. Returns undefined when GitHub can't issue one.
async function githubIdToken(audience) {
  const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  url.searchParams.append('audience', audience);
  for (let attempt = 1; attempt <= TRANSIENT_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const body = await response.json().catch(() => undefined);
      if (response.ok && typeof body?.value === 'string') return body.value;
    } catch {
      // Network error / timeout: transient, retry.
    }
    if (attempt < TRANSIENT_RETRIES) await sleep(attempt * 1000);
  }
  return undefined;
}

// The registry half of the publish-time exchange (pnpm: releasing/commands
// publish/oidc/authToken.js, npm: lib/utils/oidc.js). The returned token is
// never read beyond checking it is present.
async function exchangeIdToken(registry, name, idToken) {
  for (let attempt = 1; attempt <= TRANSIENT_RETRIES; attempt++) {
    try {
      const response = await fetch(`${registry}/-/npm/v1/oidc/token/exchange/package/${escapedName(name)}`, {
        method: 'POST',
        body: '',
        headers: { Accept: 'application/json', Authorization: `Bearer ${idToken}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const body = await response.json().catch(() => undefined);
      if (response.ok && typeof body?.token === 'string') return { trusted: true };
      if (!response.ok && !isTransient(response.status)) {
        const message = typeof body?.message === 'string' ? body.message.slice(0, 200) : undefined;
        return { trusted: false, refusal: `HTTP ${response.status}${message ? `: ${message}` : ''}` };
      }
      // Transient status, or a 2xx without a token: retry.
    } catch {
      // Network error / timeout: transient, retry.
    }
    if (attempt < TRANSIENT_RETRIES) await sleep(attempt * 1000);
  }
  return { trusted: undefined, reason: 'npm token exchange endpoint errors' };
}

async function trustedPublishingWorks(registry, name) {
  // A fresh GitHub token per attempt, as pnpm does per package.
  const idToken = await githubIdToken(`npm:${new URL(registry).hostname}`);
  if (!idToken) return { trusted: undefined, reason: 'GitHub OIDC token endpoint errors' };
  const result = await exchangeIdToken(registry, name, idToken);
  return { ...result, retryable: result.trusted === false };
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

function printTrustInstructions({ pkg, refusal }) {
  console.error(`✘ npm refused trusted publishing for ${pkg.name} (${refusal}).`);
  console.error('');
  console.error('  npm only hands this job a token when the package has a trusted');
  console.error('  publisher for GitHub repo mastra-ai/mastra, workflow npm-publish.yml.');
  console.error('  This package has none, one for another repo or workflow, or one limited');
  console.error('  to a GitHub environment, so its publish would fail mid-release');
  console.error('  (ERR_PNPM_AUTH_TOKEN_EXCHANGE).');
  console.error('');
  console.error('  An npm org admin must configure it. After `npm login`, from a checkout of');
  console.error('  mastra-ai/mastra (publishes nothing for a package that already exists):');
  console.error(`    node scripts/npm-placeholder-publish.mjs ${pkg.name}`);
  console.error('  or directly:');
  console.error(
    `    npx npm@^11.15.0 trust github ${pkg.name} --file npm-publish.yml --repo mastra-ai/mastra --allow-publish`,
  );
  console.error(`  Check what is configured now with: npx npm@^11.15.0 trust list ${pkg.name}`);
  console.error('');
}

// stdout/stderr writes to a pipe are asynchronous on Linux, so process.exit()
// straight after many lines can drop the tail of the output (the summary).
async function exit(code) {
  await Promise.all([process.stdout, process.stderr].map(stream => new Promise(resolve => stream.write('', resolve))));
  process.exit(code);
}

async function reportUnverifiable(unverifiable, what) {
  console.error(
    `Could not verify ${unverifiable.length} package(s) ${what}: ${unverifiable.map(({ pkg, reason }) => `${pkg.name}${reason ? ` (${reason})` : ''}`).join(', ')}`,
  );
  await exit(2);
}

const options = parseArgs(process.argv.slice(2));

if (options.oidc && ID_TOKEN_ENV.some(name => !process.env[name])) {
  console.error(
    `--oidc needs a GitHub Actions OIDC token (${ID_TOKEN_ENV.join(', ')} are not set). Run it in a job with \`permissions: id-token: write\`.`,
  );
  process.exit(2);
}

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

const results = await checkAll(packages, options.retry404, pkg => packageExists(options.registry, pkg.name));

const missing = results.filter(result => result.exists === false);
const unverifiable = results.filter(result => result.exists === undefined);

for (const { pkg } of missing) {
  printRecoveryInstructions(pkg);
}

if (missing.length > 0) {
  console.error(
    `${missing.length} package(s) have never been published to npm: ${missing.map(({ pkg }) => pkg.name).join(', ')}`,
  );
  await exit(1);
}

if (unverifiable.length > 0) {
  await reportUnverifiable(unverifiable, `against ${options.registry} (registry errors)`);
}

console.log(`All ${packages.length} publishable package(s) exist on npm.`);

if (!options.oidc) {
  // Advisory only: the PR check has no OIDC token to try the exchange, and a
  // freshly reserved placeholder has no trusted-publishing history yet.
  for (const { pkg } of results.filter(result => !result.everTrustedPublished)) {
    console.log(
      `::warning title=No trusted-publishing history::${pkg.name} exists on npm, but no version of it was published through npm trusted publishing (OIDC). Expected for a new placeholder; otherwise confirm its trusted publisher with \`npx npm@^11.15.0 trust list ${pkg.name}\` (it must be GitHub repo mastra-ai/mastra, workflow npm-publish.yml). The publish job checks this for real before publishing.`,
    );
  }
  await exit(0);
}

console.log(`Checking npm trusted publishing (OIDC token exchange) for ${packages.length} package(s)...`);

const trustResults = await checkAll(
  packages,
  options.retry404,
  pkg => trustedPublishingWorks(options.registry, pkg.name),
  {
    failFastIfAllRetryable: true,
  },
);

const untrusted = trustResults.filter(result => result.trusted === false);
for (const result of untrusted) {
  printTrustInstructions(result);
}
if (untrusted.length > 0) {
  console.error(
    `${untrusted.length} package(s) cannot publish through npm trusted publishing: ${untrusted.map(({ pkg }) => pkg.name).join(', ')}`,
  );
  if (untrusted.length === packages.length && packages.length > 1) {
    console.error(
      'Every package was refused. If they published from this workflow before, suspect the job rather than the packages: it must run from mastra-ai/mastra, workflow file npm-publish.yml.',
    );
  }
  await exit(1);
}

const trustUnverifiable = trustResults.filter(result => result.trusted === undefined);
if (trustUnverifiable.length > 0) {
  await reportUnverifiable(trustUnverifiable, 'for trusted publishing');
}

console.log(
  `npm granted this job a trusted-publishing token for all ${packages.length} package(s) (publish permission is not checked here; see scripts/npm-placeholder-publish.mjs).`,
);
