#!/usr/bin/env node
// Reserves a new workspace package's name on npm with an empty 0.0.0
// placeholder, then configures npm trusted publishing for it.
//
// npm-publish.yml publishes with npm trusted publishing (OIDC) and has no token
// fallback, and npm only allows a trusted publisher on a package that already
// exists. A brand-new package therefore needs to exist on npm before CI can
// publish it. The placeholder contains only a package.json and README — no code
// from any branch — so nothing unreviewed is published. CI then publishes the
// real versions through Changesets. Prereleases go out under the `alpha`
// dist-tag, which leaves `latest` on 0.0.0 until the package's first stable
// release, so the placeholder tells installers to use `@alpha` until then.
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
// `npm trust` shipped in npm 11.10.0, but `--allow-publish` only in 11.15.0;
// older versions reject it with `EUSAGE: Unknown flag`.
const NPM_WITH_TRUST = 'npm@^11.15.0';
const TRUST_REPO = 'mastra-ai/mastra';
const TRUST_FILE = 'npm-publish.yml';
const TRUST_ARGS = ['--file', TRUST_FILE, '--repo', TRUST_REPO, '--allow-publish'];

function usage() {
  return 'Usage: node scripts/npm-placeholder-publish.mjs <package-name> [--dry-run] [--otp <code>] [--skip-trust] [--registry <url>]';
}

function fail(message, code = 1) {
  console.error(`✘ ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const options = { name: undefined, registry: DEFAULT_REGISTRY, dryRun: false, otp: undefined, skipTrust: false };
  const value = i => {
    if (argv[i] === undefined || argv[i].startsWith('-')) fail(`Missing value for ${argv[i - 1]}\n${usage()}`);
    return argv[i];
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--skip-trust') options.skipTrust = true;
    else if (arg === '--otp') options.otp = value(++i);
    else if (arg === '--registry') options.registry = value(++i).replace(/\/+$/, '');
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
    const response = await fetch(`${registry}/${name.replaceAll('/', '%2f')}`, { signal: AbortSignal.timeout(15_000) });
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

// `npm trust list --json` prints one JSON object per trusted publisher
// ({ type, file, repository, ... }), separated by blank lines. Returns
// undefined when the list can't be read.
function readTrust(options) {
  const args = ['--yes', NPM_WITH_TRUST, 'trust', 'list', options.name, '--json', '--registry', options.registry];
  if (options.otp) args.push('--otp', options.otp);
  const result = spawnSync('npx', args, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
  if (result.status !== 0) return undefined;
  try {
    return result.stdout
      .split(/\n\s*\n/)
      .map(block => block.trim())
      .filter(Boolean)
      .map(block => JSON.parse(block));
  } catch {
    return undefined;
  }
}

const isPublishWorkflowTrust = config =>
  config.type === 'github' && config.repository === TRUST_REPO && config.file === TRUST_FILE;

// Why a trusted publisher for this repo and workflow still can't publish, or
// undefined when it can. The publish jobs declare no GitHub environment, so
// their OIDC token has no environment claim. Settings made before npm had
// permissions carry no `permissions` field and allow publishing.
function trustProblem(config) {
  if (config.environment) {
    return `it is restricted to GitHub environment "${config.environment}", but the publish jobs in ${TRUST_FILE} run without one`;
  }
  if (Array.isArray(config.permissions) && !config.permissions.includes('createPackage')) {
    return `it allows only ${config.permissions.join(', ') || 'no permissions'}, not publishing (createPackage)`;
  }
  return undefined;
}

const isUsablePublishWorkflowTrust = config => isPublishWorkflowTrust(config) && !trustProblem(config);

function failUnusableTrust(configs) {
  const unusable = configs.filter(config => isPublishWorkflowTrust(config) && trustProblem(config));
  if (unusable.length === 0) return;
  const lines = unusable.map(config => `  - ${config.id ?? '(no id)'}: ${trustProblem(config)}`);
  fail(
    [
      `${options.name} has a trusted publisher for ${TRUST_REPO} ${TRUST_FILE} that cannot publish, so the publish job would still fail:`,
      ...lines,
      'Remove it, then re-run this script to configure one that can:',
      ...unusable.map(
        config =>
          `    npx ${NPM_WITH_TRUST} trust revoke ${options.name} --id ${config.id ?? '<id from npm trust list>'}`,
      ),
    ].join('\n'),
  );
}

const describeTrust = configs =>
  configs.length === 0
    ? 'none'
    : configs
        .map(config => {
          const problem = isPublishWorkflowTrust(config) && trustProblem(config);
          return `${config.type} ${config.repository ?? '?'} ${config.file ?? '?'}${problem ? ` (unusable: ${problem})` : ''}`;
        })
        .join('; ');

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
      description: `Empty placeholder reserving ${manifest.name} on npm. Until its first stable release, install ${manifest.name}@alpha.`,
      ...(manifest.license ? { license: manifest.license } : {}),
      ...(manifest.repository ? { repository: manifest.repository } : {}),
    };
    writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(placeholder, null, 2)}\n`);
    writeFileSync(
      path.join(dir, 'README.md'),
      `# ${manifest.name}\n\nThis ${PLACEHOLDER_VERSION} release is an empty placeholder with no code. It reserves the package name so npm trusted publishing can be configured for mastra-ai/mastra.\n\nUntil the first stable release, real versions are published as prereleases under the \`alpha\` dist-tag, and \`latest\` still points to this placeholder. Install with:\n\n\`\`\`\nnpm install ${manifest.name}@alpha\n\`\`\`\n`,
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
  const before = readTrust(options);
  if (before?.some(isUsablePublishWorkflowTrust)) {
    console.log(`Trusted publishing for ${TRUST_REPO} ${TRUST_FILE} is already configured for ${options.name}.`);
  } else {
    if (before) failUnusableTrust(before);
    if (before?.length) {
      console.log(`${options.name} currently trusts: ${describeTrust(before)}.`);
      console.log(
        `If npm refuses a second trusted publisher, remove that one with \`npx ${NPM_WITH_TRUST} trust revoke\` first.`,
      );
    }
    run('npx', [...trustArgs, '--registry', options.registry]);
    // Read it back: publishing only works if it names this repo and workflow.
    const after = readTrust(options);
    if (!after) {
      fail(`Configured trusted publishing, but could not read it back with \`npm trust list ${options.name}\`.`);
    }
    if (!after.some(isUsablePublishWorkflowTrust)) {
      fail(
        `npm reports no trusted publisher for ${TRUST_REPO} ${TRUST_FILE} on ${options.name} after configuring it (found: ${describeTrust(after)}).`,
      );
    }
    console.log(`Trusted publishing configured for ${options.name}: verified ${TRUST_REPO} ${TRUST_FILE}.`);
  }
}

console.log('');
console.log(
  'Next: re-run the failed "New packages exist on npm" PR check or the failed publish job. CI publishes the real versions.',
);
