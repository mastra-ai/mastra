#!/usr/bin/env node
/**
 * Produces the Mastra Software Factory template tree from `mastracode/web`.
 *
 * The template is the web project minus monorepo coupling:
 *   - `link:` deps           -> caret ranges on published versions (verified on npm)
 *   - monorepo tsconfig      -> standalone tsconfig
 *   - contributor README     -> checked-in template/README.md (version tokens filled)
 *   - e2e/tests/test deps    -> stripped
 *   - monorepo-only scripts  -> user-facing scripts (dev/build/start/deploy)
 *   - .env.schema            -> also emitted as .env.example (decorators stripped)
 *
 * Versions: Mastra deps become caret ranges (`^1.51.0` style), matching the
 * monorepo's other templates (templates/* float via `latest`/caret). By
 * default the range is anchored on the LOCAL monorepo version of each
 * package (verified to exist on npm); `--tag latest` anchors on the `latest`
 * dist-tags instead. Automated sync uses the default mode so the generated
 * template matches the coherent local package set. Because those anchors
 * may be prereleases, the template ships an `.npmrc`
 * with `legacy-peer-deps=true` — npm's strict resolver rejects prereleases
 * like `1.51.1-alpha.1` against peer ranges like `>=1.50.0-0`.
 *
 * Usage:
 *   node scripts/sync-template.mjs [--out <dir>] [--tag latest]
 *
 * Output defaults to `template-out/` next to this package (gitignored).
 * Publish flow: automated — the sync-softwarefactory-template workflow runs
 * this against published local monorepo versions on pushes to main touching
 * `mastracode/web`, then force-syncs the softwarefactory-template repository,
 * mirroring the templates/* sync process (one-way overwrite; the monorepo is
 * truth).
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
const pinTag = argValue('--tag'); // undefined = local monorepo versions

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
  'pnpm-lock.yaml',
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

function monorepoVersion(name, relPath) {
  const pkgJsonPath = path.join(monorepoRoot, relPath, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  if (pkg.name !== name) {
    throw new Error(`sync-template: ${pkgJsonPath} is named ${pkg.name}, expected ${name}`);
  }
  return pkg.version;
}

/**
 * Resolve the version to pin: the local monorepo version (default, verified
 * published) or the requested dist-tag.
 */
function resolvePinnedVersion(name, relPath) {
  if (pinTag) {
    try {
      return execFileSync('npm', ['view', name, `dist-tags.${pinTag}`], { stdio: 'pipe' })
        .toString()
        .trim();
    } catch {
      throw new Error(`sync-template: could not resolve ${name}@${pinTag} on npm.`);
    }
  }
  const version = monorepoVersion(name, relPath);
  try {
    execFileSync('npm', ['view', `${name}@${version}`, 'version'], { stdio: 'pipe' });
  } catch {
    throw new Error(
      `sync-template: ${name}@${version} (local monorepo version) is not published on npm — ` +
        `publish it (or wait for the release train), or sync with --tag latest.`,
    );
  }
  return version;
}

function transformPackageJson() {
  const manifest = JSON.parse(fs.readFileSync(path.join(webRoot, 'package.json'), 'utf8'));

  manifest.name = 'mastra-software-factory';
  manifest.version = '0.1.0';
  manifest.description =
    'Mastra Software Factory: an agent-powered software delivery environment. Intake GitHub/Linear issues, work them with coding agents, and ship pull requests — all from your own deployable web app.';
  manifest.private = true;
  manifest.license = 'Apache-2.0';

  // Direct mapping of the web project's own scripts (web:dev / web:build /
  // web:start), minus monorepo-only bits (prebuild, monorepo-deps.mjs).
  manifest.scripts = {
    dev: 'concurrently --kill-others-on-fail --names server,ui "MASTRA_SKIP_PEERDEP_CHECK=1 varlock run -- mastra dev --dir src/mastra" "vite --config src/web/vite.config.ts"',
    'db:up': 'docker compose up -d --wait',
    'db:down': 'docker compose down',
    build: 'npm run build:ui && npm run build:server',
    'build:ui': 'vite --config src/web/vite.config.ts build',
    'build:server': 'mastra build --dir src/mastra',
    start: 'varlock run -- mastra start',
    deploy: 'npm run build && node scripts/validate-output.mjs && mastra deploy --skip-build',
    check: 'tsc --noEmit && tsc --noEmit -p src/web/ui/tsconfig.json',
  };

  const pins = [];
  console.log(
    pinTag
      ? `sync-template: pinning npm ${pinTag} dist-tags...`
      : 'sync-template: pinning local monorepo versions (verified on npm)...',
  );
  for (const section of ['dependencies', 'devDependencies']) {
    const deps = manifest[section];
    if (!deps) continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (!spec.startsWith('link:')) continue;
      const version = resolvePinnedVersion(name, linkSpecToRelPath(spec));
      // Caret ranges, matching the monorepo's other templates (templates/*):
      // the scaffold floats to compatible releases instead of freezing the
      // exact set that existed at sync time.
      deps[name] = `^${version}`;
      pins.push([name, version]);
      console.log(`  ✓ ${name}@^${version}`);
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

  // The template installs with `legacy-peer-deps=true` (see writeNpmrc), which
  // skips automatic peer installation. Most peers are already direct deps;
  // these transitive runtime peers are not, so declare them explicitly.
  // (In the monorepo dev setup pnpm's auto-install-peers provides them.)
  manifest.dependencies['react-is'] = '^19.0.0'; // peer of recharts (via @mastra/playground-ui)
  const memoryVersion = resolvePinnedVersion('@mastra/memory', 'packages/memory');
  manifest.dependencies['@mastra/memory'] = `^${memoryVersion}`; // peer of @mastra/playground-ui
  pins.push(['@mastra/memory', memoryVersion]);
  console.log(`  ✓ @mastra/memory@^${memoryVersion}`);

  fs.writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return pins;
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
    '# Mastra Software Factory environment.',
    '# Copied to .env by `npm create factory`; every value is optional —',
    '# features light up as their variables are set (see README.md).',
    '# Validation source of truth: .env.schema (varlock).',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, '.env.example'), `${header}${body}`);
}

function writeNpmrc() {
  // Pins may be prerelease versions (mid-train alphas); npm's strict resolver
  // rejects prereleases against peer ranges like `>=1.50.0-0`, so relax peer
  // resolution. pnpm/yarn ignore this setting and handle peers leniently.
  fs.writeFileSync(path.join(outDir, '.npmrc'), 'legacy-peer-deps=true\n');
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
src/mastra/public/ui/
*.log
.DS_Store
`,
  );
}

/**
 * Copy the checked-in user-facing README and fill `{{package-name}}` tokens
 * with the versions this sync run pinned. Tokens keep the markdown editable
 * as a normal file (create-mastra style) while still reflecting live pins.
 */
function writeReadme(pins) {
  const source = path.join(pkgRoot, 'template', 'README.md');
  if (!fs.existsSync(source)) {
    throw new Error(`sync-template: missing checked-in template README at ${source}`);
  }
  const versions = Object.fromEntries(pins);
  const readme = fs.readFileSync(source, 'utf8').replace(/\{\{([^}]+)\}\}/g, (match, name) => {
    return Object.hasOwn(versions, name) ? versions[name] : match;
  });
  fs.writeFileSync(path.join(outDir, 'README.md'), readme);
}

// ── main ────────────────────────────────────────────────────────────────────

if (!fs.existsSync(path.join(webRoot, 'package.json'))) {
  console.error(`sync-template: web project not found at ${webRoot}`);
  process.exit(1);
}

console.log(`sync-template: ${webRoot} -> ${outDir}`);
// Clear the output tree but keep its .git — template-out doubles as the
// checkout that pushes to the template repo, and deleting .git would make
// git commands silently fall through to the enclosing monorepo repo.
if (fs.existsSync(outDir)) {
  for (const entry of fs.readdirSync(outDir)) {
    if (entry === '.git') continue;
    fs.rmSync(path.join(outDir, entry), { recursive: true, force: true });
  }
}
copyTree(webRoot, outDir);
const pins = transformPackageJson();
writeTsconfig();
stripTestingTypesFromUiTsconfig();
writeEnvExample();
writeNpmrc();
writeGitignore();
writeReadme(pins);

console.log(`sync-template: done. Template written to ${outDir}`);
console.log('The sync-softwarefactory-template workflow pushes this to the template repo on main.');
