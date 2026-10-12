#!/usr/bin/env node
// Reserves a new workspace package's name on npm with an empty 0.0.0
// placeholder, then configures npm trusted publishing for it.
//
// npm-publish.yml publishes with npm trusted publishing (OIDC) and has no token
// fallback, and npm only allows a trusted publisher on a package that already
// exists. A brand-new package therefore needs to exist on npm before CI can
// publish it. The placeholder contains only a package.json and README — no code
// from any branch — so nothing unreviewed is published. The first real version
// is published by CI through Changesets and supersedes 0.0.0 as `latest`.
//
// Run by an npm org admin, logged in with `npm login`, from the repo root:
//   node scripts/npm-placeholder-publish.mjs <package-name> [--dry-run]
//        [--otp <code>] [--skip-trust] [--registry <url>]
//
// Exit codes: 0 = done (or dry run complete), 1 = refused / command failed,
//             2 = could not verify the package on the registry

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const PLACEHOLDER_VERSION = '0.0.0';
// `npm trust` first shipped in npm 11.10.0.
const NPM_WITH_TRUST = 'npm@^11.10.0';
const TRUST_ARGS = ['--file', 'npm-publish.yml', '--repo', 'mastra-ai/mastra', '--allow-publish'];

function usage() {
  return 'Usage: node scripts/npm-placeholder-publish.mjs <package-name> [--dry-run] [--otp <code>] [--skip-trust] [--registry <url>]';
}

function fail(message, code = 1) {
  console.error(`✘ ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const options = { name: undefined, registry: DEFAULT_REGISTRY, dryRun: false, otp: undefined, skipTrust: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--skip-trust') options.skipTrust = true;
    else if (arg === '--otp') options.otp = argv[++i];
    else if (arg === '--registry') options.registry = argv[++i].replace(/\/+$/, '');
    else if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else if (arg.startsWith('-')) fail(`Unknown argument: ${arg}\n${usage()}`);
    else if (options.name) fail(`Only one package name is accepted.\n${usage()}`);
    else options.name = arg;
  }
  if (!options.name) fail(`Missing package name.\n${usage()}`);
  return options;
}

// Only names of non-private packages in this workspace are accepted, so a typo
// can't reserve an unrelated name on npm.
function findWorkspacePackage(name) {
  const output = execFileSync('pnpm', ['m', 'ls', '--depth', '-1', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const pkg = JSON.parse(output).find(candidate => candidate.name === name);
  if (!pkg) fail(`${name} is not a package in this workspace.`);
  const manifest = JSON.parse(readFileSync(path.join(pkg.path, 'package.json'), 'utf8'));
  if (manifest.private) fail(`${name} is "private": true — it is never published, so it needs no placeholder.`);
  return manifest;
}

async function existsOnRegistry(registry, name) {
  try {
    const response = await fetch(`${registry}/${name.replace('/', '%2f')}`, { signal: AbortSignal.timeout(15_000) });
    await response.arrayBuffer();
    if (response.status === 200) return true;
    if (response.status === 404) return false;
  } catch {
    // Fall through: unverifiable.
  }
  fail(`Could not check ${name} on ${registry}; refusing to publish without knowing whether it exists.`, 2);
}

function run(command, args, options = {}) {
  const commandLine = [command, ...args].join(' ').replace(/--otp \S+/, '--otp ***');
  console.log(`$ ${commandLine}`);
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) fail(`Failed (exit ${result.status ?? result.signal}): ${commandLine}`);
}

function publishPlaceholder(manifest, options) {
  if (!options.dryRun) {
    const whoami = spawnSync('npm', ['whoami', '--registry', options.registry], { encoding: 'utf8' });
    if (whoami.status !== 0) fail(`Not logged in to ${options.registry}. Run \`npm login\` as an npm org admin first.`);
    console.log(`Publishing as npm user ${whoami.stdout.trim()}.`);
  }

  const dir = mkdtempSync(path.join(tmpdir(), 'npm-placeholder-'));
  try {
    const placeholder = {
      name: manifest.name,
      version: PLACEHOLDER_VERSION,
      description: `Placeholder reserving ${manifest.name} on npm. The first real release is published from mastra-ai/mastra by CI.`,
      ...(manifest.license ? { license: manifest.license } : {}),
      ...(manifest.repository ? { repository: manifest.repository } : {}),
    };
    writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(placeholder, null, 2)}\n`);
    writeFileSync(
      path.join(dir, 'README.md'),
      `# ${manifest.name}\n\nThis ${PLACEHOLDER_VERSION} release is an empty placeholder that reserves the package name so npm trusted publishing can be configured. Install a later version.\n`,
    );

    const args = ['publish', '--access', 'public', '--registry', options.registry];
    if (options.otp) args.push('--otp', options.otp);
    if (options.dryRun) args.push('--dry-run');
    run('npm', args, { cwd: dir });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const options = parseArgs(process.argv.slice(2));
const manifest = findWorkspacePackage(options.name);

if (await existsOnRegistry(options.registry, options.name)) {
  console.log(`${options.name} already exists on ${options.registry}; no placeholder needed.`);
} else {
  publishPlaceholder(manifest, options);
  if (!options.dryRun) console.log(`Published ${options.name}@${PLACEHOLDER_VERSION} placeholder.`);
}

const trustArgs = ['--yes', NPM_WITH_TRUST, 'trust', 'github', options.name, ...TRUST_ARGS];
if (options.dryRun || options.skipTrust) {
  console.log('Configure trusted publishing (not run):');
  console.log(`  npx ${trustArgs.join(' ')}`);
} else {
  run('npx', [...trustArgs, '--registry', options.registry]);
  console.log(`Trusted publishing configured for ${options.name}.`);
}

console.log('');
console.log(
  'Next: re-run the failed "New packages exist on npm" PR check or the failed publish job. The first real version is published by CI.',
);
