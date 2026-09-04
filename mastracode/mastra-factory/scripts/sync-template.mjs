#!/usr/bin/env node
/**
 * Produces the Mastra Factory template from the user-owned server scaffold in
 * `mastracode/web`. The Factory UI is supplied by the Mastra CLI at runtime,
 * so the generated project intentionally contains no browser source or Vite
 * dependencies.
 *
 * Source files:
 *   - src/mastra/index.ts
 *   - .env.schema
 *   - docker-compose.yml
 *
 * Generated files:
 *   - package.json, tsconfig.json, .env.example, .gitignore
 *   - pnpm-workspace.yaml, optional .npmrc, README.md
 *
 * Usage:
 *   node scripts/sync-template.mjs [--out <dir>] [--tag <dist-tag>]
 *
 * `--tag` pins every linked dependency to one dist-tag, for the local E2E
 * registry. Otherwise matching latest/alpha releases are selected.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const webRoot = path.resolve(pkgRoot, '../web');
const monorepoRoot = path.resolve(pkgRoot, '../..');

const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}
const defaultOutDir = path.join(pkgRoot, 'template-out');
const outDir = path.resolve(argValue('--out') ?? defaultOutDir);
const pinTag = argValue('--tag');
if (args.includes('--tag') && (!pinTag || pinTag.startsWith('--'))) {
  console.error('sync-template: --tag requires a non-empty dist-tag value');
  process.exit(1);
}

function containsPath(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

const customOutOverlapsMonorepo =
  outDir !== defaultOutDir && (containsPath(monorepoRoot, outDir) || containsPath(outDir, monorepoRoot));
if (customOutOverlapsMonorepo) {
  console.error(`sync-template: unsafe output directory ${outDir} (overlaps the monorepo)`);
  process.exit(1);
}

const RUNTIME_DEPENDENCIES = [
  '@mastra/auth-workos',
  '@mastra/code-sdk',
  '@mastra/core',
  '@mastra/e2b',
  '@mastra/factory',
  '@mastra/libsql',
  '@mastra/pg',
  '@mastra/platform-workspace',
  '@mastra/redis-streams',
  // @mastra/factory's runtime schema surface is externalized by the CLI build.
  'zod',
];
const TOOL_DEPENDENCIES = ['@types/node', 'mastra', 'typescript', 'varlock'];

function linkSpecToRelPath(spec) {
  const target = path.resolve(webRoot, spec.slice('link:'.length));
  const rel = path.relative(monorepoRoot, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`sync-template: link spec ${spec} resolves outside the monorepo (${target})`);
  }
  return rel;
}

function linkedPackageVersion(name, relPath) {
  const pkgJsonPath = path.join(monorepoRoot, relPath, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  if (pkg.name !== name) {
    throw new Error(`sync-template: ${pkgJsonPath} is named ${pkg.name}, expected ${name}`);
  }
  return pkg.version;
}

const resolvedVersions = new Map();
let usesPrereleaseVersions = false;
function resolveTaggedVersion(name, tag) {
  const key = `${name}@${tag}`;
  const cached = resolvedVersions.get(key);
  if (cached) return cached;

  try {
    const version = execFileSync('npm', ['view', name, `dist-tags.${tag}`], { stdio: 'pipe' })
      .toString()
      .trim();
    if (!version) throw new Error('empty version');
    if (version.includes('-')) usesPrereleaseVersions = true;
    resolvedVersions.set(key, version);
    return version;
  } catch {
    throw new Error(`sync-template: could not resolve ${name}@${tag} on npm.`);
  }
}

function baseVersion(version) {
  return version.split('-')[0];
}

function resolveLinkedVersion(name, localVersion) {
  if (pinTag) return { version: resolveTaggedVersion(name, pinTag), tag: pinTag };

  const localBase = baseVersion(localVersion);
  if (!localVersion.includes('-alpha.')) {
    const latestVersion = resolveTaggedVersion(name, 'latest');
    if (baseVersion(latestVersion) === localBase) return { version: latestVersion, tag: 'latest' };
  }

  const alphaVersion = resolveTaggedVersion(name, 'alpha');
  if (baseVersion(alphaVersion) === localBase) return { version: alphaVersion, tag: 'alpha' };

  throw new Error(`sync-template: no published ${name} version matches local release ${localBase}.`);
}

function sourceDependencySpec(manifest, name) {
  const spec = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
  if (!spec) throw new Error(`sync-template: mastracode/web is missing required dependency ${name}`);
  return spec;
}

function resolveDependency(manifest, name) {
  const spec = sourceDependencySpec(manifest, name);
  if (!spec.startsWith('link:')) return spec;

  const localVersion = linkedPackageVersion(name, linkSpecToRelPath(spec));
  const { version, tag } = resolveLinkedVersion(name, localVersion);
  console.log(`  ✓ ${name}@${version} (${tag})`);
  return version;
}

function writePackageJson() {
  const webManifest = JSON.parse(fs.readFileSync(path.join(webRoot, 'package.json'), 'utf8'));
  const dependencies = {};
  const devDependencies = {};

  console.log('sync-template: resolving published versions for template dependencies...');
  for (const name of RUNTIME_DEPENDENCIES) dependencies[name] = resolveDependency(webManifest, name);
  for (const name of TOOL_DEPENDENCIES) devDependencies[name] = resolveDependency(webManifest, name);

  // The deployer still loads the classic TypeScript API through
  // typescript-paths; tsgo does not expose the required CommonJS surface.
  devDependencies.typescript = '^5.9.2';

  const manifest = {
    name: 'mastra-factory',
    version: '0.1.0',
    description:
      'Mastra Factory: an agent-powered software delivery environment. Intake GitHub/Linear issues, work them with coding agents, and ship pull requests — all from your own deployable web app.',
    private: true,
    type: 'module',
    license: 'Apache-2.0',
    scripts: {
      dev: 'mastra factory dev --dir src/mastra',
      'db:up': 'docker compose up -d --wait',
      'db:down': 'docker compose down',
      check: 'tsc --noEmit',
      build: 'mastra build --dir src/mastra',
      start: 'varlock run -- mastra start',
      deploy: 'mastra deploy',
    },
    dependencies,
    devDependencies,
    engines: webManifest.engines,
  };

  // Transitive runtime peer that must be declared as a direct dep so npm
  // resolves it without needing pnpm's auto-install-peers behavior.
  const { version: memoryVersion, tag: memoryTag } = resolveLinkedVersion(
    '@mastra/memory',
    linkedPackageVersion('@mastra/memory', 'packages/memory'),
  );
  manifest.dependencies['@mastra/memory'] = memoryVersion;
  console.log(`  ✓ @mastra/memory@${memoryVersion} (${memoryTag})`);

  fs.writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function writeTsconfig() {
  const tsconfig = {
    compilerOptions: {
      esModuleInterop: true,
      skipLibCheck: true,
      target: 'es2022',
      allowJs: true,
      resolveJsonModule: true,
      moduleDetection: 'force',
      isolatedModules: true,
      verbatimModuleSyntax: true,
      strict: true,
      noUncheckedIndexedAccess: true,
      declaration: true,
      declarationMap: true,
      module: 'Preserve',
      noEmit: true,
      lib: ['ES2023'],
      types: ['node'],
    },
    include: ['src/**/*'],
    exclude: ['node_modules'],
  };
  fs.writeFileSync(path.join(outDir, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`);
}

function writeEnvExample() {
  const schema = fs.readFileSync(path.join(webRoot, '.env.schema'), 'utf8');
  const lines = schema.split('\n');
  const out = [];
  let inHeader = true;
  for (const line of lines) {
    if (inHeader) {
      if (line.trim() === '# ---') inHeader = false;
      continue;
    }
    if (/^\s*#\s*@/.test(line)) continue;
    if (/^[A-Z][A-Z0-9_]*=\s*$/.test(line)) {
      out.push(`# ${line.trim()}`);
      continue;
    }
    out.push(line);
  }
  const body = out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimStart();
  const header = [
    '# Mastra Factory environment.',
    '# Copied to .env by `npm create factory`; every value is optional —',
    '# features light up as their variables are set (see README.md).',
    '# Validation source of truth: .env.schema (varlock).',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, '.env.example'), `${header}${body}`);
}

function writeGitignore() {
  fs.writeFileSync(
    path.join(outDir, '.gitignore'),
    `node_modules/
.env
.env.*
!.env.example
!.env.schema
.mastra/
*.log
.DS_Store
`,
  );
}

function writeNpmrc() {
  if (!usesPrereleaseVersions) return;
  fs.writeFileSync(path.join(outDir, '.npmrc'), 'legacy-peer-deps=true\n');
}

function writePnpmWorkspace() {
  const content = `# pnpm configuration for the Mastra Factory template.
# Prevents ERR_PNPM_IGNORED_BUILDS on pnpm v10+ by explicitly approving
# (or declining) build scripts for dependencies that have them.
# npm ignores this file entirely; it only affects pnpm installs.
minimumReleaseAgeExclude:
  - '@mastra/*'
  - mastra
allowBuilds:
  '@google/genai': true
  agent-browser: true
  bufferutil: true
  edgedriver: false
  esbuild: true
  geckodriver: false
  onnxruntime-node: true
  protobufjs: true
  utf-8-validate: true
`;
  fs.writeFileSync(path.join(outDir, 'pnpm-workspace.yaml'), content);
}

function writeReadme() {
  const source = path.join(pkgRoot, 'template', 'README.md');
  if (!fs.existsSync(source)) {
    throw new Error(`sync-template: missing checked-in template README at ${source}`);
  }
  fs.copyFileSync(source, path.join(outDir, 'README.md'));
}

function copySourceFile(relativePath) {
  const source = path.join(webRoot, relativePath);
  if (!fs.existsSync(source)) throw new Error(`sync-template: source file not found: ${source}`);
  const destination = path.join(outDir, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

if (!fs.existsSync(path.join(webRoot, 'package.json'))) {
  console.error(`sync-template: web project not found at ${webRoot}`);
  process.exit(1);
}

console.log(`sync-template: ${webRoot} -> ${outDir}`);
if (fs.existsSync(outDir)) {
  for (const entry of fs.readdirSync(outDir)) {
    if (entry === '.git') continue;
    fs.rmSync(path.join(outDir, entry), { recursive: true, force: true });
  }
}
fs.mkdirSync(outDir, { recursive: true });
copySourceFile('src/mastra/index.ts');
copySourceFile('.env.schema');
copySourceFile('docker-compose.yml');
writePackageJson();
writeTsconfig();
writeEnvExample();
writeGitignore();
writeNpmrc();
writePnpmWorkspace();
writeReadme();

console.log(`sync-template: done. Template written to ${outDir}`);
console.log('The sync-softwarefactory-template workflow pushes this to the template repo on main.');
