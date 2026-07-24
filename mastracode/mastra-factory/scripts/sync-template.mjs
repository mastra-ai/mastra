#!/usr/bin/env node
/**
 * Produces the Mastra Factory template tree from two source roots:
 *   - `mastracode/web`          — server/deployment files (src/mastra, scripts, .env.schema)
 *   - `mastracode/factory-ui`   — browser application source (src/shared, src/web/ui, vite.config.ts)
 *
 * The template is a single standalone project — the web host's server tree plus
 * the factory-ui app tree merged into the same established `src/shared` and
 * `src/web/ui` paths. Monorepo coupling is removed:
 *   - `link:`/`workspace:` deps -> exact versions resolved from npm
 *   - `catalog:` deps           -> resolved from the monorepo pnpm-workspace.yaml catalog
 *   - monorepo tsconfig         -> standalone tsconfig
 *   - contributor README        -> checked-in template/README.md
 *   - e2e/tests/test deps       -> stripped
 *   - monorepo-only scripts     -> user-facing scripts (dev/build/start/deploy)
 *   - .env.schema               -> also emitted as .env.example (decorators stripped)
 *   - `@internal/factory-ui`    -> excluded (private package, not published)
 *
 * Versions: every `link:`/`workspace:` dep is resolved from npm and written as
 * an exact version. The sync selects `latest` or `alpha`, whichever has the same
 * base version as the local source package, so release transitions cannot pair
 * new source with an older stable package.
 *
 * Usage:
 *   node scripts/sync-template.mjs [--out <dir>] [--tag <dist-tag>]
 *
 * `--tag` pins every `link:` dep to one dist-tag instead, for registries that
 * publish the whole workspace under a single tag (the E2E registry).
 *
 * Output defaults to `template-out/` next to this package (gitignored).
 * Publish flow: automated — the sync-softwarefactory-template workflow runs
 * this on pushes to main touching `mastracode/web` or `mastracode/factory-ui`,
 * then force-syncs the softwarefactory-template repository, mirroring the
 * templates/* sync process (one-way overwrite; the monorepo is truth).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const webRoot = path.resolve(pkgRoot, '../web');
const factoryUiRoot = path.resolve(pkgRoot, '../factory-ui');
const monorepoRoot = path.resolve(pkgRoot, '../..');

const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}
const defaultOutDir = path.join(pkgRoot, 'template-out');
const outDir = path.resolve(argValue('--out') ?? defaultOutDir);
const pinTag = argValue('--tag'); // undefined = resolve from latest/alpha
if (args.includes('--tag') && (!pinTag || pinTag.startsWith('--'))) {
  console.error('sync-template: --tag requires a non-empty dist-tag value');
  process.exit(1);
}

/** True when `candidate` is `parent` or nested inside it. */
function containsPath(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

// The output tree gets recursively deleted before generation. Allow the fixed,
// gitignored default inside this package; require every custom destination to
// be completely outside the monorepo so a typo cannot delete source files.
const customOutOverlapsMonorepo =
  outDir !== defaultOutDir && (containsPath(monorepoRoot, outDir) || containsPath(outDir, monorepoRoot));
if (customOutOverlapsMonorepo) {
  console.error(`sync-template: unsafe output directory ${outDir} (overlaps the monorepo)`);
  process.exit(1);
}

/**
 * Resolve a `link:` spec from the web manifest to the linked package's
 * monorepo directory (relative to monorepoRoot). Link paths are relative to
 * the web project root (e.g. `link:../../stores/pg` -> `stores/pg`).
 *
 * Linked packages are discovered from the manifest rather than a hardcoded
 * list so a new `link:` dep added to mastracode/web can never slip into the
 * template untransformed (npm cannot install `link:` specs).
 */
function linkSpecToRelPath(spec) {
  const target = path.resolve(webRoot, spec.slice('link:'.length));
  const rel = path.relative(monorepoRoot, target);
  if (rel.startsWith('..')) {
    throw new Error(`sync-template: link spec ${spec} resolves outside the monorepo (${target})`);
  }
  return rel;
}

/**
 * Resolve a `workspace:*` spec to the workspace package's monorepo directory
 * (relative to monorepoRoot). Scans the `packages:` globs in pnpm-workspace.yaml
 * to find the package by name — this works even when the workspace member's
 * node_modules symlinks are not installed (e.g. in CI E2E contexts where only
 * a filtered subset of the monorepo is installed).
 *
 * Workspace packages are discovered rather than hardcoded so a new `workspace:`
 * dep added to factory-ui can never slip into the template untransformed.
 */
function findWorkspacePackageDir(name) {
  const wsPath = path.join(monorepoRoot, 'pnpm-workspace.yaml');
  const content = fs.readFileSync(wsPath, 'utf8');
  let inPackages = false;
  const globs = [];
  for (const line of content.split('\n')) {
    if (/^packages:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    if (line.length === 0 || line.startsWith('#')) continue;
    if (!line.startsWith(' ')) {
      inPackages = false;
      continue;
    }
    const match = line.match(/^\s+-\s+['"]?([^'"\n]+)['"]?\s*$/);
    if (match) globs.push(match[1]);
  }

  for (const glob of globs) {
    const parts = glob.split('/');
    const wildcardIdx = parts.findIndex(p => p.includes('*'));
    const baseParts = wildcardIdx === -1 ? parts : parts.slice(0, wildcardIdx);
    const basePath = path.join(monorepoRoot, ...baseParts);
    if (!fs.existsSync(basePath)) continue;

    const candidates =
      wildcardIdx === -1
        ? [basePath]
        : fs.readdirSync(basePath, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => path.join(basePath, e.name));

    for (const dir of candidates) {
      const pkgJsonPath = path.join(dir, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkg.name === name) return path.relative(monorepoRoot, dir);
    }
  }

  throw new Error(`sync-template: workspace dep ${name} not found in pnpm-workspace.yaml packages`);
}

function workspaceSpecToRelPath(name) {
  return findWorkspacePackageDir(name);
}

/** Private monorepo packages that must never appear in the generated template. */
const PRIVATE_PACKAGES = new Set(['@internal/factory-ui']);

/**
 * Parse the default `catalog:` section from the monorepo's pnpm-workspace.yaml.
 * Catalog entries map package names to version specs (exact or range); these
 * replace `catalog:` specs in the factory-ui manifest so the standalone
 * template has no monorepo-only protocol specs.
 */
function readCatalog() {
  const wsPath = path.join(monorepoRoot, 'pnpm-workspace.yaml');
  const content = fs.readFileSync(wsPath, 'utf8');
  const catalog = {};
  let inCatalog = false;
  for (const line of content.split('\n')) {
    if (/^catalog:/.test(line)) {
      inCatalog = true;
      continue;
    }
    if (!inCatalog) continue;
    // Blank lines and comments are tolerated within the section.
    if (line.length === 0 || line.startsWith('#')) continue;
    // A non-indented line ends the catalog section.
    if (!line.startsWith(' ')) {
      inCatalog = false;
      continue;
    }
    const match = line.match(/^\s+([@\w./-]+):\s*(.+)$/);
    if (match) catalog[match[1]] = match[2].trim();
  }
  return catalog;
}

/** devDependencies that only support the monorepo test suites. */
const TEST_ONLY_DEV_DEPS = [
  '@ai-sdk/openai',
  '@copilotkit/aimock',
  '@testing-library/dom',
  '@testing-library/jest-dom',
  '@testing-library/react',
  '@testing-library/user-event',
  'jsdom',
  'msw',
  'tsx',
  'vitest',
];

/** Top-level entries never copied into the template. */
const EXCLUDE_TOP_LEVEL = new Set([
  'node_modules',
  '.mastra',
  'e2e',
  // The web project is its own pnpm workspace root wired to the monorepo via
  // `link:` deps — none of that applies to the standalone template. A clean
  // template-specific pnpm-workspace.yaml (allowBuilds only) is written by
  // writePnpmWorkspace() below.
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'package-lock.json',
  'vitest.config.ts',
  // Replaced with template-specific versions:
  'README.md',
  '.gitignore',
  'tsconfig.json',
]);

/** Path predicates (relative, posix separators) for excluded files anywhere. */
function isExcluded(rel) {
  const basename = path.posix.basename(rel);
  if (rel.startsWith('src/mastra/public/')) return true; // vite build output
  if (rel === 'scripts/monorepo-deps.mjs') return true;
  // Test-only helpers (vitest, mount fixtures). Match any *test-utils* name —
  // e.g. src/web/test-utils.ts AND src/web/storage/test-utils.ts — so the
  // template never depends on vitest after we strip it from devDependencies.
  if (/(^|\/|[-_.])test-utils\.(ts|tsx|mts|mjs)$/.test(rel)) return true;
  if (/(^|\/)__tests__(\/|$)/.test(rel)) return true;
  if (/\.test\.(ts|tsx|mts|mjs)$/.test(rel)) return true;
  // Never ship someone's local env (.env, .env.local, ...) — only the schema.
  if (basename === '.env' || (basename.startsWith('.env.') && basename !== '.env.schema')) return true;
  return false;
}

function copyTree(srcDir, destDir, relBase = '') {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (!relBase && EXCLUDE_TOP_LEVEL.has(entry.name)) continue;
    if (isExcluded(rel)) continue;
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to, rel);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

/** Verify the linked package exists and return its local version. */
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
  // Snapshot registries version everything `0.0.0-<tag>-<timestamp>`, so the
  // release-train match below can never hold.
  if (pinTag) {
    return { version: resolveTaggedVersion(name, pinTag), tag: pinTag };
  }

  const localBase = baseVersion(localVersion);

  if (!localVersion.includes('-alpha.')) {
    const latestVersion = resolveTaggedVersion(name, 'latest');
    if (baseVersion(latestVersion) === localBase) {
      return { version: latestVersion, tag: 'latest' };
    }
  }

  const alphaVersion = resolveTaggedVersion(name, 'alpha');
  if (baseVersion(alphaVersion) === localBase) {
    return { version: alphaVersion, tag: 'alpha' };
  }

  throw new Error(`sync-template: no published ${name} version matches local release ${localBase}.`);
}

function transformPackageJson() {
  const manifest = JSON.parse(fs.readFileSync(path.join(webRoot, 'package.json'), 'utf8'));
  const factoryUiManifest = JSON.parse(fs.readFileSync(path.join(factoryUiRoot, 'package.json'), 'utf8'));

  manifest.name = 'mastra-factory';
  manifest.version = '0.1.0';
  manifest.description =
    'Mastra Factory: an agent-powered software delivery environment. Intake GitHub/Linear issues, work them with coding agents, and ship pull requests — all from your own deployable web app.';
  manifest.private = true;
  manifest.license = 'Apache-2.0';

  // Use the Factory server's integrated UI instead of running a separate
  // Vite process. Keep standalone validation and lifecycle scripts.
  manifest.scripts = {
    dev: 'mastra factory dev --dir src/mastra',
    'db:up': 'docker compose up -d --wait',
    'db:down': 'docker compose down',
    check: 'tsc --noEmit && tsc --noEmit -p src/web/ui/tsconfig.json',
    build: 'mastra build --dir src/mastra',
    start: 'varlock run -- mastra start',
    deploy: 'mastra deploy',
  };

  // The private @internal/factory-ui package is a build-time link from the web
  // host — it is not published and must never appear in the template manifest.
  // Its deps (React, Vite, Tailwind, etc.) are merged from its own manifest
  // below.
  for (const section of ['dependencies', 'devDependencies']) {
    for (const name of PRIVATE_PACKAGES) {
      delete manifest[section]?.[name];
    }
  }

  // Merge the factory-ui manifest's deps into the web manifest. The web host
  // no longer carries React/Vite/Tailwind etc. — those live in factory-ui now.
  // Skip private packages and deps already present from web (the web host
  // carries the server's @mastra/* link: deps, which are resolved below).
  const catalog = readCatalog();
  for (const section of ['dependencies', 'devDependencies']) {
    const uiDeps = factoryUiManifest[section];
    if (!uiDeps) continue;
    const target = (manifest[section] ??= {});
    for (const [name, spec] of Object.entries(uiDeps)) {
      if (PRIVATE_PACKAGES.has(name)) continue;
      if (target[name] !== undefined) continue; // web manifest wins for shared deps
      target[name] = spec;
    }
  }

  // Resolve each linked/workspace package from a published release with the
  // same base version as its local source. Immediately after exiting
  // prerelease mode, `latest` can still point at the previous stable release
  // while `alpha` contains the package matching the newly-stable local source
  // version.
  console.log('sync-template: resolving published versions for link:/workspace: deps...');
  for (const section of ['dependencies', 'devDependencies']) {
    const deps = manifest[section];
    if (!deps) continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (spec.startsWith('link:')) {
        const localVersion = linkedPackageVersion(name, linkSpecToRelPath(spec));
        const { version, tag } = resolveLinkedVersion(name, localVersion);
        deps[name] = version;
        console.log(`  ✓ ${name}@${version} (${tag})`);
      } else if (spec.startsWith('workspace:')) {
        const localVersion = linkedPackageVersion(name, workspaceSpecToRelPath(name));
        const { version, tag } = resolveLinkedVersion(name, localVersion);
        deps[name] = version;
        console.log(`  ✓ ${name}@${version} (${tag}, workspace)`);
      } else if (spec.startsWith('catalog:')) {
        const catalogVersion = catalog[name];
        if (!catalogVersion) {
          throw new Error(`sync-template: catalog spec ${name}@${spec} has no entry in pnpm-workspace.yaml catalog`);
        }
        deps[name] = catalogVersion;
        console.log(`  ✓ ${name}@${catalogVersion} (catalog)`);
      }
    }
  }

  for (const dep of TEST_ONLY_DEV_DEPS) {
    delete manifest.devDependencies?.[dep];
  }

  // npm cannot install monorepo-only protocols; nothing may slip through.
  for (const section of ['dependencies', 'devDependencies']) {
    for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
      if (/^(link:|workspace:|file:|catalog:)/.test(spec)) {
        throw new Error(`sync-template: unresolved monorepo spec in template: ${name}@${spec}`);
      }
    }
  }

  // Transitive runtime peers that must be declared as direct deps so npm
  // resolves them without needing pnpm's auto-install-peers behavior.
  // (In the monorepo dev setup pnpm provides them automatically.)
  // Under --tag, `latest` can belong to a different snapshot set on shared
  // registries, which would install a second @mastra/memory copy.
  manifest.dependencies['@mastra/memory'] = resolveTaggedVersion('@mastra/memory', pinTag ?? 'latest'); // peer of @mastra/playground-ui
  manifest.dependencies['react-is'] = '^19.0.0'; // peer of recharts (via @mastra/playground-ui)

  // Downgrade `typescript` from tsgo (v7) to classic (v5). The Mastra Factory
  // sources happily typecheck under tsgo, but `mastra build` transitively
  // loads the classic TypeScript API via `typescript-paths` — tsgo's ESM
  // package doesn't expose `ts.sys`, so `require('typescript')` returns an
  // almost-empty module and analyzeBundle crashes with
  //   TypeError: Cannot read properties of undefined (reading 'readFile')
  // In the monorepo pnpm hoists classic TypeScript from another workspace
  // package, hiding the problem. In the standalone template there is no
  // hoist, so we pin the classic compiler here. Remove once
  // `typescript-paths` (or whatever @mastra/deployer uses) supports tsgo.
  if (manifest.devDependencies?.typescript) {
    manifest.devDependencies.typescript = '^5.9.2';
  }
  if (manifest.devDependencies?.concurrently) {
    delete manifest.devDependencies.concurrently;
  }

  fs.writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function writeTsconfig() {
  // Standalone equivalent of the monorepo's tsconfig.node.json + the web
  // package's local include/exclude (test files are already stripped).
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
    exclude: ['node_modules', 'src/web/ui', 'src/web/vite.config.ts', 'src/shared/**/*.tsx', 'src/shared/hooks'],
  };
  fs.writeFileSync(path.join(outDir, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`);
}

function stripTestingTypesFromUiTsconfig() {
  const uiTsconfigPath = path.join(outDir, 'src/web/ui/tsconfig.json');
  const raw = fs.readFileSync(uiTsconfigPath, 'utf8');
  // The template drops @testing-library/* deps, so the ambient types entry
  // would fail `tsc -p src/web/ui/tsconfig.json`.
  const next = raw.replace(`, "@testing-library/jest-dom"`, '');
  if (next === raw) {
    throw new Error('sync-template: expected "@testing-library/jest-dom" in src/web/ui/tsconfig.json types');
  }
  fs.writeFileSync(uiTsconfigPath, next);
}

function writeEnvExample() {
  // Derive .env.example from .env.schema: drop varlock decorator comments
  // (`# @...`) and the schema header block, keep prose comments + assignments.
  const schema = fs.readFileSync(path.join(webRoot, '.env.schema'), 'utf8');
  const lines = schema.split('\n');
  const out = [];
  let inHeader = true;
  for (const line of lines) {
    if (inHeader) {
      // Header ends at the `# ---` divider that closes the varlock file header.
      if (line.trim() === '# ---') inHeader = false;
      continue;
    }
    if (/^\s*#\s*@/.test(line)) continue; // varlock decorator line
    // Empty assignments become commented placeholders: an active `KEY=` loads
    // as the empty string (not "unset"), which poisons the server's
    // `process.env.X ?? default` fallbacks.
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
src/mastra/public/factory/
*.log
.DS_Store
`,
  );
}

/**
 * Relax npm's peer resolver when the generated package set includes
 * prereleases. npm does not match prerelease versions against otherwise
 * compatible peer ranges unless the range names that prerelease explicitly.
 */
function writeNpmrc() {
  if (!usesPrereleaseVersions) return;
  fs.writeFileSync(path.join(outDir, '.npmrc'), 'legacy-peer-deps=true\n');
}

/**
 * Emit `pnpm-workspace.yaml` with `allowBuilds`.
 *
 * pnpm v10+ blocks install scripts by default and exits with
 * ERR_PNPM_IGNORED_BUILDS if any dependency has a build script that isn't
 * explicitly approved. The deployer also copies this file to `.mastra/output`,
 * so without it `mastra build` / `mastra start` fail under pnpm.
 *
 * Mirrors the mastracode/web allowBuilds policy, minus test-only deps (msw)
 * stripped by the template. Packages marked `false` don't need their build
 * script at runtime — listing them prevents the ignored-builds error without
 * actually running the script.
 */
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

/** Copy the checked-in user-facing README verbatim. */
function writeReadme() {
  const source = path.join(pkgRoot, 'template', 'README.md');
  if (!fs.existsSync(source)) {
    throw new Error(`sync-template: missing checked-in template README at ${source}`);
  }
  fs.copyFileSync(source, path.join(outDir, 'README.md'));
}

// ── main ────────────────────────────────────────────────────────────────────

if (!fs.existsSync(path.join(webRoot, 'package.json'))) {
  console.error(`sync-template: web project not found at ${webRoot}`);
  process.exit(1);
}
if (!fs.existsSync(path.join(factoryUiRoot, 'package.json'))) {
  console.error(`sync-template: factory-ui package not found at ${factoryUiRoot}`);
  process.exit(1);
}

console.log(`sync-template: ${webRoot} + ${factoryUiRoot} -> ${outDir}`);
// Clear the output tree but keep its .git — template-out doubles as the
// checkout that pushes to the template repo, and deleting .git would make
// git commands silently fall through to the enclosing monorepo repo.
if (fs.existsSync(outDir)) {
  for (const entry of fs.readdirSync(outDir)) {
    if (entry === '.git') continue;
    fs.rmSync(path.join(outDir, entry), { recursive: true, force: true });
  }
}
// Copy server/deployment files from the web host (src/mastra, scripts, .env.schema).
copyTree(webRoot, outDir);
// Copy the browser application source from factory-ui into the same established
// src/shared and src/web/ui paths so the 200+ reciprocal imports stay relative.
copyTree(path.join(factoryUiRoot, 'src'), path.join(outDir, 'src'), 'src');
transformPackageJson();
writeTsconfig();
stripTestingTypesFromUiTsconfig();
writeEnvExample();
writeGitignore();
writeNpmrc();
writePnpmWorkspace();
writeReadme();

console.log(`sync-template: done. Template written to ${outDir}`);
console.log('The sync-softwarefactory-template workflow pushes this to the template repo on main.');
