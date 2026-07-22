#!/usr/bin/env node
/**
 * Produces the Mastra Factory template tree from `mastracode/web`.
 *
 * The template is the web project minus monorepo coupling:
 *   - `link:` deps           -> `"alpha"` (Mastra packages ship as a set)
 *   - monorepo tsconfig      -> standalone tsconfig
 *   - contributor README     -> checked-in template/README.md
 *   - e2e/tests/test deps    -> stripped
 *   - monorepo-only scripts  -> user-facing scripts (dev/build/start/deploy)
 *   - .env.schema            -> also emitted as .env.example (decorators stripped)
 *
 * Versions: every `link:` dep becomes `"alpha"`. The Mastra Factory sources on
 * `main` are built against the alpha release train, not the stable `latest`
 * tag — several packages the template needs (notably `@mastra/factory`) only
 * exist as prereleases today, and pinning individual packages to `latest`
 * while the rest are alphas breaks peer resolution. Floating to the `alpha`
 * dist-tag keeps the whole install internally consistent; once the packages
 * cut stable releases we can switch this back to `"latest"`.
 *
 * Usage:
 *   node scripts/sync-template.mjs [--out <dir>]
 *
 * Output defaults to `template-out/` next to this package (gitignored).
 * Publish flow: automated — the sync-softwarefactory-template workflow runs
 * this on pushes to main touching `mastracode/web`, then force-syncs the
 * softwarefactory-template repository, mirroring the templates/* sync process
 * (one-way overwrite; the monorepo is truth).
 */
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

/**
 * Verify the linked package exists in the monorepo and its manifest name
 * matches the dependency key. This is a source-of-truth check only — no
 * version is read from it; the template pins `"alpha"` from npm.
 */
function assertLinkedPackage(name, relPath) {
  const pkgJsonPath = path.join(monorepoRoot, relPath, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  if (pkg.name !== name) {
    throw new Error(`sync-template: ${pkgJsonPath} is named ${pkg.name}, expected ${name}`);
  }
}

function transformPackageJson() {
  const manifest = JSON.parse(fs.readFileSync(path.join(webRoot, 'package.json'), 'utf8'));

  manifest.name = 'mastra-factory';
  manifest.version = '0.1.0';
  manifest.description =
    'Mastra Factory: an agent-powered software delivery environment. Intake GitHub/Linear issues, work them with coding agents, and ship pull requests — all from your own deployable web app.';
  manifest.private = true;
  manifest.license = 'Apache-2.0';

  // Direct mapping of the web project's own scripts (web:dev / web:build /
  // web:start), minus monorepo-only bits (prebuild, monorepo-deps.mjs).
  manifest.scripts = {
    dev: 'concurrently --kill-others-on-fail --names server,ui "MASTRA_SKIP_PEERDEP_CHECK=1 varlock run -- mastra factory dev --dir src/mastra" "vite --config src/web/vite.config.ts"',
    'dev:prod':
      'npm run build:ui && PORT=5173 MASTRA_SKIP_PEERDEP_CHECK=1 varlock run -- mastra factory dev --dir src/mastra',
    'db:up': 'docker compose up -d --wait',
    'db:down': 'docker compose down',
    build: 'mastra build --dir src/mastra',
    'build:ui': 'vite --config src/web/vite.config.ts build',
    start: 'varlock run -- mastra start',
    deploy: 'npm run build && node scripts/validate-output.mjs && mastra deploy --skip-build',
    check: 'tsc --noEmit && tsc --noEmit -p src/web/ui/tsconfig.json',
  };

  // Every `link:` dep becomes `"alpha"`. The Mastra Factory sources are built
  // against the alpha release train, so the template floats to the same
  // dist-tag rather than mixing `latest` and `alpha` across the Mastra set.
  // We still resolve the link target so an invalid `link:` spec (typo,
  // deleted package) fails the sync loudly.
  console.log('sync-template: rewriting link: deps to "alpha"...');
  for (const section of ['dependencies', 'devDependencies']) {
    const deps = manifest[section];
    if (!deps) continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (!spec.startsWith('link:')) continue;
      assertLinkedPackage(name, linkSpecToRelPath(spec));
      deps[name] = 'alpha';
      console.log(`  ✓ ${name}@alpha`);
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
  manifest.dependencies['@mastra/memory'] = 'alpha'; // peer of @mastra/playground-ui
  manifest.dependencies['react-is'] = '^19.0.0'; // peer of recharts (via @mastra/playground-ui)

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
 * Emit `.npmrc` with `legacy-peer-deps=true`.
 *
 * The Mastra packages ship as an internally-consistent alpha release train:
 * peer-dependency *ranges* are correctly stated across the set, but npm 7+
 * enforces peer resolution strictly and rejects prerelease versions that
 * satisfy a peer range but not a concrete peer pin. In the monorepo pnpm
 * relaxes this automatically; downstream `npm install` needs the equivalent
 * knob or every scaffolded template fails on install.
 *
 * When the packages cut stable releases and the template pins `"latest"`
 * again, this file can be removed.
 */
function writeNpmrc() {
  fs.writeFileSync(path.join(outDir, '.npmrc'), 'legacy-peer-deps=true\n');
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
transformPackageJson();
writeTsconfig();
stripTestingTypesFromUiTsconfig();
writeEnvExample();
writeGitignore();
writeNpmrc();
writeReadme();

console.log(`sync-template: done. Template written to ${outDir}`);
console.log('The sync-softwarefactory-template workflow pushes this to the template repo on main.');
