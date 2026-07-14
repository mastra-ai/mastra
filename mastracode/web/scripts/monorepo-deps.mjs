#!/usr/bin/env node
/**
 * Switches the monorepo-provided dependencies in package.json between
 * `link:` specs (development default) and the exact versions found in the
 * monorepo (used for real builds, so the deployable output pins installable
 * versions instead of `link:`/`latest`).
 *
 * Usage:
 *   node scripts/monorepo-deps.mjs pin              # link: -> exact monorepo versions
 *   node scripts/monorepo-deps.mjs link             # exact versions -> link: specs
 *   node scripts/monorepo-deps.mjs run -- <cmd...>  # pin, run command, always restore
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Package name -> monorepo directory, relative to mastracode/web. */
const LINKED_PACKAGES = {
  '@mastra/auth-workos': '../../auth/workos',
  '@mastra/client-js': '../../client-sdks/client-js',
  '@mastra/code-sdk': '../sdk',
  '@mastra/core': '../../packages/core',
  '@mastra/hono': '../../server-adapters/hono',
  '@mastra/libsql': '../../stores/libsql',
  '@mastra/playground-ui': '../../packages/playground-ui',
  '@mastra/railway': '../../workspaces/railway',
  '@mastra/react': '../../client-sdks/react',
  '@mastra/redis-streams': '../../pubsub/redis-streams',
  mastra: '../../packages/cli',
};

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = path.join(webRoot, 'package.json');

function monorepoVersion(name, relPath) {
  const pkgJsonPath = path.join(webRoot, relPath, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    throw new Error(`monorepo-deps: ${pkgJsonPath} not found (expected package root for ${name})`);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  if (pkg.name !== name) {
    throw new Error(`monorepo-deps: ${pkgJsonPath} is named ${pkg.name}, expected ${name} — update LINKED_PACKAGES`);
  }
  if (!pkg.version) {
    throw new Error(`monorepo-deps: ${pkgJsonPath} has no version`);
  }
  return pkg.version;
}

function rewriteSpecs(specFor) {
  const manifest = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const changes = [];
  for (const [name, relPath] of Object.entries(LINKED_PACKAGES)) {
    for (const section of ['dependencies', 'devDependencies']) {
      const deps = manifest[section];
      if (!deps?.[name]) continue;
      const next = specFor(name, relPath);
      if (deps[name] !== next) {
        changes.push(`  ${name}: ${deps[name]} -> ${next}`);
        deps[name] = next;
      }
    }
  }
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return changes;
}

function pin() {
  const changes = rewriteSpecs((name, relPath) => monorepoVersion(name, relPath));
  console.log(
    changes.length
      ? `monorepo-deps: pinned exact monorepo versions\n${changes.join('\n')}`
      : 'monorepo-deps: already pinned',
  );
}

function link() {
  const changes = rewriteSpecs((_name, relPath) => `link:${relPath}`);
  console.log(
    changes.length ? `monorepo-deps: restored link: specs\n${changes.join('\n')}` : 'monorepo-deps: already linked',
  );
}

async function run(command) {
  if (command.length === 0) {
    console.error('monorepo-deps: run requires a command, e.g. run -- mastra build --dir src/mastra');
    process.exit(1);
  }
  const original = fs.readFileSync(packageJsonPath, 'utf8');
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    fs.writeFileSync(packageJsonPath, original);
    console.log('monorepo-deps: restored package.json');
  };
  process.on('SIGINT', () => {
    restore();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    restore();
    process.exit(143);
  });
  process.on('exit', restore);

  try {
    pin();
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), {
        cwd: webRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          MASTRA_SKIP_PEERDEP_CHECK: '1',
          PATH: `${path.join(webRoot, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH ?? ''}`,
        },
      });
      child.on('error', reject);
      child.on('close', code => resolve(code ?? 1));
    });
    process.exitCode = exitCode;
  } finally {
    restore();
  }
}

const [mode, ...rest] = process.argv.slice(2);
const command = rest[0] === '--' ? rest.slice(1) : rest;

switch (mode) {
  case 'pin':
    pin();
    break;
  case 'link':
    link();
    break;
  case 'run':
    await run(command);
    break;
  default:
    console.error('monorepo-deps: usage: monorepo-deps.mjs <pin|link|run -- <cmd...>>');
    process.exit(1);
}
