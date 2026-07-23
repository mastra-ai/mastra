import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Validates the output of scripts/sync-template.mjs — the artifact users
 * actually receive. Runs the real script offline: a fake `npm` on PATH
 * answers the latest-version lookups so no network is needed.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const webRoot = path.resolve(pkgRoot, '../web');
const script = path.join(pkgRoot, 'scripts', 'sync-template.mjs');

let workDir: string;
let outDir: string;
let fakeBinDir: string;
let sentinel: string;

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

  // Fake npm: resolves every `latest` dist-tag to a deterministic version.
  fakeBinDir = path.join(workDir, 'bin');
  fs.mkdirSync(fakeBinDir);
  fs.writeFileSync(path.join(fakeBinDir, 'npm'), '#!/bin/sh\necho "9.9.9"\n', { mode: 0o755 });

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

    // package.json: monorepo coupling removed; every Mastra dep uses the exact
    // version resolved from npm's `latest` dist-tag.
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, 'package.json'), 'utf8'));
    const allDeps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, spec] of Object.entries(allDeps)) {
      expect(spec, `${name} must not use a link:/workspace: spec`).not.toMatch(/^(link|workspace|catalog|file):/);
      if (name === 'mastra' || name.startsWith('@mastra/')) {
        expect(spec, `${name} must use the resolved latest version`).toBe('9.9.9');
      }
    }
    expect(pkg.dependencies['@mastra/memory']).toBe('9.9.9');
    // No `.npmrc` ships — the template installs cleanly on npm with the
    // published `latest` set, same as every other create-mastra template.
    expect(fs.existsSync(path.join(outDir, '.npmrc'))).toBe(false);

    // `typescript` is downgraded from tsgo (v7) to the classic compiler (v5)
    // because `mastra build` transitively loads TypeScript via
    // `typescript-paths`, which needs the classic `ts.sys` API tsgo does not
    // expose. Remove once the deployer supports tsgo.
    expect(pkg.devDependencies.typescript).toMatch(/^\^5\./);

    // Package-manager coupling never ships: the web project's lockfiles stay
    // behind. A template-specific `pnpm-workspace.yaml` with only `allowBuilds`
    // is emitted so pnpm v10+ installs don't error on
    // ERR_PNPM_IGNORED_BUILDS.
    expect(fs.existsSync(path.join(outDir, 'pnpm-lock.yaml'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, 'package-lock.json'))).toBe(false);
    const pnpmWorkspace = fs.readFileSync(path.join(outDir, 'pnpm-workspace.yaml'), 'utf8');
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
    expect(pkg.scripts.check).toBe('tsc --noEmit && tsc --noEmit -p src/web/ui/tsconfig.json');
    expect(pkg.scripts.build).toBe('mastra build --dir src/mastra');
    expect(pkg.scripts['build:ui']).toBeUndefined();
    expect(pkg.scripts['build:server']).toBeUndefined();
    expect(pkg.scripts.deploy).toBe('mastra deploy');
    expect(pkg.devDependencies.concurrently).toBeUndefined();
    // The generated .gitignore ignores the Vite output directory.
    const gitignore = fs.readFileSync(path.join(outDir, '.gitignore'), 'utf8');
    expect(gitignore).toContain('src/mastra/public/factory/');
    expect(gitignore).not.toContain('src/mastra/public/ui/');
  });
});
