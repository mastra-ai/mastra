import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** Validates the standalone artifact users receive from `npm create factory`. */

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const webRoot = path.resolve(pkgRoot, '../web');
const script = path.join(pkgRoot, 'scripts', 'sync-template.mjs');
const TEMPLATE_LINKED_DEPENDENCIES = [
  '@mastra/auth-workos',
  '@mastra/code-sdk',
  '@mastra/core',
  '@mastra/e2b',
  '@mastra/factory',
  '@mastra/libsql',
  '@mastra/pg',
  '@mastra/platform-workspace',
  '@mastra/redis-streams',
  'mastra',
];

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

  const webManifest = JSON.parse(fs.readFileSync(path.join(webRoot, 'package.json'), 'utf8'));
  linkedLocalVersions = {};
  const registryVersions: Record<string, Record<string, string>> = {};

  for (const name of TEMPLATE_LINKED_DEPENDENCIES) {
    const spec = webManifest.dependencies?.[name] ?? webManifest.devDependencies?.[name];
    expect(spec, `${name} must remain a link dependency in mastracode/web`).toMatch(/^link:/);
    const linkedManifest = JSON.parse(
      fs.readFileSync(path.resolve(webRoot, spec.slice('link:'.length), 'package.json'), 'utf8'),
    ) as { version: string };
    linkedLocalVersions[name] = linkedManifest.version;
    const baseVersion = linkedManifest.version.split('-')[0]!;
    registryVersions[name] = { latest: baseVersion, alpha: `${baseVersion}-alpha.0` };
  }

  const memoryVersion = JSON.parse(
    fs.readFileSync(path.resolve(pkgRoot, '../..', 'packages/memory/package.json'), 'utf8'),
  ).version as string;
  linkedLocalVersions['@mastra/memory'] = memoryVersion;
  const memoryBaseVersion = memoryVersion.split('-')[0]!;
  registryVersions['@mastra/memory'] = { latest: memoryBaseVersion, alpha: `${memoryBaseVersion}-alpha.0` };

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

  it('generates a minimal server scaffold with exact published dependencies', () => {
    const result = runSync(['--out', outDir]);
    expect(result.status).toBe(0);

    expect(fs.existsSync(path.join(outDir, 'src/mastra/index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, '.env.schema'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, '.env.example'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'docker-compose.yml'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'tsconfig.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, '.env.test-sentinel'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, '.env'))).toBe(false);

    for (const absentPath of [
      'e2e',
      'scripts',
      'vitest.config.ts',
      'src/api',
      'src/hooks',
      'src/lib',
      'src/ui',
      'src/vite.config.ts',
      'src/mastra/public',
      // Slack ships inside @mastra/factory; the scaffold imports it rather
      // than carrying a vendored copy it would have to maintain.
      'src/web',
    ]) {
      expect(fs.existsSync(path.join(outDir, absentPath)), `${absentPath} must not ship`).toBe(false);
    }

    const envExample = fs.readFileSync(path.join(outDir, '.env.example'), 'utf8');
    expect(envExample).not.toMatch(/^[A-Z][A-Z0-9_]*=\s*$/m);

    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, 'package.json'), 'utf8'));
    const allDeps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, spec] of Object.entries(allDeps)) {
      expect(spec, `${name} must not use a monorepo spec`).not.toMatch(/^(link|workspace|catalog|file):/);
      if (name === 'mastra' || name.startsWith('@mastra/')) {
        expect(spec, `${name} must use an exact resolved version`).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
      }
      expect(name).not.toMatch(/^@internal\//);
    }
    for (const [name, localVersion] of Object.entries(linkedLocalVersions)) {
      const baseVersion = localVersion.split('-')[0]!;
      const expectedVersion = localVersion.includes('-alpha.') ? `${baseVersion}-alpha.0` : baseVersion;
      expect(allDeps[name], `${name} must match its local source release`).toBe(expectedVersion);
    }

    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      '@mastra/auth-workos',
      '@mastra/code-sdk',
      '@mastra/core',
      '@mastra/e2b',
      '@mastra/factory',
      '@mastra/libsql',
      '@mastra/memory',
      '@mastra/pg',
      '@mastra/platform-workspace',
      '@mastra/redis-streams',
      'zod',
    ]);
    expect(pkg.devDependencies.typescript).toMatch(/^\^5\./);
    expect(pkg.dependencies['react-is']).toBeUndefined();
    for (const browserDependency of ['react', 'react-dom', '@tanstack/react-query', 'vite', 'tailwindcss']) {
      expect(allDeps[browserDependency]).toBeUndefined();
    }

    expect(pkg.scripts).toMatchObject({
      dev: 'mastra factory dev --dir src/mastra',
      check: 'tsc --noEmit',
      build: 'mastra build --dir src/mastra',
      start: 'varlock run -- mastra start',
      deploy: 'mastra deploy',
    });
    expect(pkg.scripts['build:ui']).toBeUndefined();
    expect(pkg.scripts.prebuild).toBeUndefined();

    const tsconfig = JSON.parse(fs.readFileSync(path.join(outDir, 'tsconfig.json'), 'utf8'));
    expect(tsconfig.include).toEqual(['src/**/*']);
    expect(tsconfig.exclude).toEqual(['node_modules']);

    expect(fs.readFileSync(path.join(outDir, '.npmrc'), 'utf8')).toBe('legacy-peer-deps=true\n');
    const pnpmWorkspace = fs.readFileSync(path.join(outDir, 'pnpm-workspace.yaml'), 'utf8');
    expect(pnpmWorkspace).toMatch(/^minimumReleaseAgeExclude:\n  - '@mastra\/\*'\n  - mastra$/m);
    expect(pnpmWorkspace).toMatch(/^allowBuilds:/m);

    const readme = fs.readFileSync(path.join(outDir, 'README.md'), 'utf8');
    expect(readme).toContain('# Mastra Factory');
    expect(readme).toContain('npm create factory');
    expect(readme).not.toMatch(/\{\{[^}]+\}\}/);
  });
});
