import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Validates the output of scripts/sync-template.mjs — the artifact users
 * actually receive. Runs the real script offline: a fake `npm` on PATH
 * answers the dist-tag lookups so no network is needed.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const webRoot = path.resolve(pkgRoot, '../web');
const factoryUiRoot = path.resolve(pkgRoot, '../factory-ui');
const monorepoRoot = path.resolve(pkgRoot, '../..');
const script = path.join(pkgRoot, 'scripts', 'sync-template.mjs');
const ALPHA_FALLBACK_PACKAGES = new Set([
  '@mastra/client-js',
  '@mastra/code-sdk',
  '@mastra/core',
  '@mastra/factory',
  '@mastra/hono',
  '@mastra/playground-ui',
  '@mastra/react',
  'mastra',
]);

let workDir: string;
let outDir: string;
let fakeBinDir: string;
let sentinel: string;
let linkedLocalVersions: Record<string, string>;

function runSync(args: string[]): { status: number; stderr: string } {
  try {
    execFileSync(process.execPath, [script, ...args], {
      stdio: 'pipe',
      env: { ...process.env, PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH ?? ''}` },
    });
    return { status: 0, stderr: '' };
  } catch (err) {
    const e = err as { status?: number; stderr?: Buffer };
    return { status: e.status ?? 1, stderr: e.stderr?.toString() ?? '' };
  }
}

beforeAll(() => {
  workDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sf-sync-test-')));
  outDir = path.join(workDir, 'out');

  // Fake npm: model stable packages whose latest tag matches local source and
  // release-train packages whose matching base version is still on alpha.
  const webManifest = JSON.parse(fs.readFileSync(path.join(webRoot, 'package.json'), 'utf8'));
  const factoryUiManifest = JSON.parse(fs.readFileSync(path.join(factoryUiRoot, 'package.json'), 'utf8'));
  linkedLocalVersions = {};
  const registryVersions: Record<string, Record<string, string>> = {};

  function addLinkedVersion(name: string, localVersion: string) {
    const baseVersion = localVersion.split('-')[0]!;
    linkedLocalVersions[name] = localVersion;
    registryVersions[name] = {
      latest: ALPHA_FALLBACK_PACKAGES.has(name) ? '0.0.1' : baseVersion,
      alpha: `${baseVersion}-alpha.0`,
    };
  }

  // Discover link: deps from the web manifest (server-side packages).
  for (const [name, spec] of Object.entries<string>({
    ...webManifest.dependencies,
    ...webManifest.devDependencies,
  })) {
    if (!spec.startsWith('link:')) continue;
    if (name.startsWith('@internal/')) continue; // private package, not resolved
    const linkedManifest = JSON.parse(
      fs.readFileSync(path.resolve(webRoot, spec.slice('link:'.length), 'package.json'), 'utf8'),
    );
    addLinkedVersion(name, linkedManifest.version as string);
  }

  // Discover workspace: deps from the factory-ui manifest (UI-side packages).
  // These are resolved by sync-template via pnpm-workspace.yaml package glob
  // scanning (not node_modules symlinks, which may not be installed in CI).
  // Skip packages already discovered from web — both manifests reference the
  // same workspace packages (e.g. @mastra/core).
  function findWorkspacePackage(name: string): string {
    const wsContent = fs.readFileSync(path.join(monorepoRoot, 'pnpm-workspace.yaml'), 'utf8');
    let inPackages = false;
    const globs: string[] = [];
    for (const line of wsContent.split('\n')) {
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
      if (match?.[1]) globs.push(match[1]);
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
        if (pkg.name === name) return dir;
      }
    }
    throw new Error(`workspace package ${name} not found in pnpm-workspace.yaml`);
  }

  for (const [name, spec] of Object.entries<string>({
    ...factoryUiManifest.dependencies,
    ...factoryUiManifest.devDependencies,
  })) {
    if (!spec.startsWith('workspace:')) continue;
    if (linkedLocalVersions[name]) continue;
    const pkgDir = findWorkspacePackage(name);
    const linkedManifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    addLinkedVersion(name, linkedManifest.version as string);
  }

  registryVersions['@mastra/memory'] = { latest: '9.9.9', alpha: '9.9.9-alpha.0' };

  fakeBinDir = path.join(workDir, 'bin');
  fs.mkdirSync(fakeBinDir);
  const registryVersionsPath = path.join(workDir, 'registry-versions.json');
  fs.writeFileSync(registryVersionsPath, JSON.stringify(registryVersions));
  fs.writeFileSync(
    path.join(fakeBinDir, 'npm'),
    `#!/usr/bin/env node
const versions = require(${JSON.stringify(registryVersionsPath)});
const [, , command, name, field] = process.argv;
const tag = field?.replace('dist-tags.', '');
const version = command === 'view' ? versions[name]?.[tag] : undefined;
if (!version) process.exit(1);
console.log(version);
`,
    { mode: 0o755 },
  );

  // Sentinel env file in the source tree — must never reach the template.
  sentinel = path.join(webRoot, '.env.test-sentinel');
  fs.writeFileSync(sentinel, 'SECRET=leaked\n');
});

afterAll(() => {
  fs.rmSync(sentinel, { force: true });
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe.skipIf(process.platform === 'win32')('sync-template.mjs', () => {
  it.each([
    ['source project', path.join(webRoot, 'template-out')],
    ['CLI package', path.join(pkgRoot, 'src', 'template-out')],
    ['monorepo parent', path.dirname(path.resolve(pkgRoot, '../..'))],
  ])('rejects an output directory overlapping the %s', (_label, unsafeOutDir) => {
    const existedBefore = fs.existsSync(unsafeOutDir);
    const unsafe = runSync(['--out', unsafeOutDir]);
    expect(unsafe.status).not.toBe(0);
    expect(unsafe.stderr).toContain('unsafe output directory');
    expect(fs.existsSync(unsafeOutDir)).toBe(existedBefore);
  });

  it('generates a standalone template without env files or link: specs', () => {
    const result = runSync(['--out', outDir]);
    expect(result.status).toBe(0);

    // Local env files (any .env* except the schema) never ship.
    expect(fs.existsSync(path.join(outDir, '.env.test-sentinel'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, '.env'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, '.env.schema'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, '.env.example'))).toBe(true);

    // Generated user-facing files.
    expect(fs.existsSync(path.join(outDir, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'tsconfig.json'))).toBe(true);

    // README is the checked-in template copied verbatim (no build-time tokens).
    const readme = fs.readFileSync(path.join(outDir, 'README.md'), 'utf8');
    expect(readme).toContain('# Mastra Factory');
    expect(readme).toContain('npm create factory');
    expect(readme).not.toMatch(/\{\{[^}]+\}\}/);

    // The dev script is a direct mapping of the web project's own dev flow —
    // no generated wrapper script.
    expect(fs.existsSync(path.join(outDir, 'scripts', 'dev.mjs'))).toBe(false);

    // .env.example: unset vars are commented placeholders, never `KEY=`.
    const envExample = fs.readFileSync(path.join(outDir, '.env.example'), 'utf8');
    expect(envExample).not.toMatch(/^[A-Z][A-Z0-9_]*=\s*$/m);

    // package.json: monorepo coupling removed; every Mastra dep uses an exact
    // version from the release channel matching its local source package.
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, 'package.json'), 'utf8'));
    const allDeps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, spec] of Object.entries(allDeps)) {
      expect(spec, `${name} must not use a link:/workspace: spec`).not.toMatch(/^(link|workspace|catalog|file):/);
      if (name === 'mastra' || name.startsWith('@mastra/')) {
        expect(spec, `${name} must use an exact resolved version`).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
      }
    }
    for (const [name, localVersion] of Object.entries(linkedLocalVersions)) {
      const baseVersion = localVersion.split('-')[0]!;
      const expectedVersion =
        localVersion.includes('-alpha.') || ALPHA_FALLBACK_PACKAGES.has(name) ? `${baseVersion}-alpha.0` : baseVersion;
      expect(allDeps[name], `${name} must match its local source release`).toBe(expectedVersion);
    }
    expect(pkg.dependencies['@mastra/memory']).toBe('9.9.9');
    // npm needs relaxed peer resolution for prerelease packages because its
    // semver matching excludes prereleases from otherwise compatible ranges.
    expect(fs.readFileSync(path.join(outDir, '.npmrc'), 'utf8')).toBe('legacy-peer-deps=true\n');

    // `typescript` is downgraded from tsgo (v7) to the classic compiler (v5)
    // because `mastra build` transitively loads TypeScript via
    // `typescript-paths`, which needs the classic `ts.sys` API tsgo does not
    // expose. Remove once the deployer supports tsgo.
    expect(pkg.devDependencies.typescript).toMatch(/^\^5\./);

    // Package-manager coupling never ships: the web project's lockfiles stay
    // behind. A template-specific `pnpm-workspace.yaml` is emitted so pnpm v10+
    // installs don't error on ERR_PNPM_IGNORED_BUILDS and user-configured
    // minimum release ages don't block newly published Mastra packages.
    expect(fs.existsSync(path.join(outDir, 'pnpm-lock.yaml'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, 'package-lock.json'))).toBe(false);
    const pnpmWorkspace = fs.readFileSync(path.join(outDir, 'pnpm-workspace.yaml'), 'utf8');
    expect(pnpmWorkspace).toMatch(/^minimumReleaseAgeExclude:\n  - '@mastra\/\*'\n  - mastra$/m);
    expect(pnpmWorkspace).toMatch(/^allowBuilds:/m);

    // Tests and their dependencies are stripped.
    expect(allDeps.vitest).toBeUndefined();
    expect(fs.existsSync(path.join(outDir, 'e2e'))).toBe(false);
    // Test helpers (vitest imports) must not ship — typecheck would fail
    // once vitest is stripped from devDependencies.
    expect(fs.existsSync(path.join(outDir, 'src/web/test-utils.ts'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, 'src/web/storage/test-utils.ts'))).toBe(false);

    // The Factory server serves the UI and API through one process.
    expect(pkg.scripts.dev).toBe('mastra factory dev --dir src/mastra');
    expect(pkg.scripts['dev:prod']).toBeUndefined();
    expect(pkg.scripts.prebuild).toBeUndefined();
    expect(JSON.stringify(pkg.scripts)).not.toContain('monorepo-deps');
    expect(pkg.scripts.check).toBe('tsc --noEmit && tsc --noEmit -p src/ui/tsconfig.json');
    expect(pkg.scripts.build).toBe('mastra build --dir src/mastra');
    expect(pkg.scripts['build:ui']).toBeUndefined();
    expect(pkg.scripts['build:server']).toBeUndefined();
    expect(pkg.scripts.deploy).toBe('mastra deploy');
    expect(pkg.devDependencies.concurrently).toBeUndefined();
    // The generated .gitignore ignores the Vite output directory.
    const gitignore = fs.readFileSync(path.join(outDir, '.gitignore'), 'utf8');
    expect(gitignore).toContain('src/mastra/public/factory/');
    expect(gitignore).not.toContain('src/mastra/public/ui/');

    // Factory-ui source: the browser application source is composed from the
    // factory-ui package into the same established src and src/ui
    // paths so reciprocal imports between hooks, services, and components
    // stay relative.
    expect(fs.existsSync(path.join(outDir, 'src'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'src/api/config.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'src/ui'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'src/vite.config.ts'))).toBe(true);

    // The private @internal/factory-ui package must never appear in the
    // template — it is not published and template users get editable source.
    expect(allDeps['@internal/factory-ui']).toBeUndefined();
    for (const name of Object.keys(allDeps)) {
      expect(name).not.toMatch(/^@internal\//);
    }

    // Factory-ui runtime/build deps are present (moved from web to factory-ui).
    expect(allDeps.react).toBeDefined();
    expect(allDeps['react-dom']).toBeDefined();
    expect(allDeps['@tanstack/react-query']).toBeDefined();
    expect(allDeps.vite).toBeDefined();
    expect(allDeps.tailwindcss).toBeDefined();
  });
});
