import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Validates the output of scripts/sync-template.mjs — the artifact users
 * actually receive. Runs the real script offline: a fake `npm` on PATH
 * answers the version-verification calls so no network is needed.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const webRoot = path.resolve(pkgRoot, '../web');
const script = path.join(pkgRoot, 'scripts', 'sync-template.mjs');

let workDir: string;
let outDir: string;
let fakeBinDir: string;
let failingBinDir: string;
let sentinel: string;

function runSync(args: string[], overrides: { binDir?: string } = {}): { status: number; stderr: string } {
  const binDir = overrides.binDir ?? fakeBinDir;
  try {
    execFileSync(process.execPath, [script, ...args], {
      stdio: 'pipe',
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}` },
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

  // Fake npm: satisfies `npm view <pkg>@<version> version` offline.
  fakeBinDir = path.join(workDir, 'bin');
  fs.mkdirSync(fakeBinDir);
  fs.writeFileSync(path.join(fakeBinDir, 'npm'), '#!/bin/sh\necho "9.9.9"\n', { mode: 0o755 });

  // Failing fake npm: every `npm view` exits non-zero, simulating a package
  // that is not yet published. Used to exercise --skip-verify / --local-workspace.
  failingBinDir = path.join(workDir, 'bin-failing');
  fs.mkdirSync(failingBinDir);
  fs.writeFileSync(path.join(failingBinDir, 'npm'), '#!/bin/sh\necho "npm ERR! 404" >&2\nexit 1\n', { mode: 0o755 });

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

    // README is the checked-in template with version tokens filled (no bare {{tokens}} left).
    const readme = fs.readFileSync(path.join(outDir, 'README.md'), 'utf8');
    expect(readme).toContain('# Mastra Factory');
    expect(readme).toContain('npm create factory');
    expect(readme).not.toMatch(/\{\{[^}]+\}\}/);
    expect(readme).toMatch(/@mastra\/core@\d/);
    expect(readme).toMatch(/@mastra\/code-sdk@\d/);

    // The dev script is a direct mapping of the web project's own dev flow —
    // no generated wrapper script.
    expect(fs.existsSync(path.join(outDir, 'scripts', 'dev.mjs'))).toBe(false);

    // .env.example: unset vars are commented placeholders, never `KEY=`.
    const envExample = fs.readFileSync(path.join(outDir, '.env.example'), 'utf8');
    expect(envExample).not.toMatch(/^[A-Z][A-Z0-9_]*=\s*$/m);

    // package.json: monorepo coupling removed, mastra deps float via caret.
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, 'package.json'), 'utf8'));
    const allDeps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, spec] of Object.entries(allDeps)) {
      expect(spec, `${name} must not use a link:/workspace: spec`).not.toMatch(/^(link|workspace|catalog):/);
      if (name === 'mastra' || name.startsWith('@mastra/')) {
        expect(spec, `${name} must use a caret range`).toMatch(/^\^/);
      }
    }
    expect(pkg.dependencies['@mastra/memory']).toMatch(/^\^/);

    // Tests and their dependencies are stripped.
    expect(allDeps.vitest).toBeUndefined();
    expect(fs.existsSync(path.join(outDir, 'e2e'))).toBe(false);
    // Test helpers (vitest imports) must not ship — typecheck would fail
    // once vitest is stripped from devDependencies.
    expect(fs.existsSync(path.join(outDir, 'src/web/test-utils.ts'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, 'src/web/storage/test-utils.ts'))).toBe(false);

    // Scripts map the web project's own flow, minus monorepo-only bits.
    expect(pkg.scripts.dev).toContain('concurrently');
    expect(pkg.scripts.dev).toContain('mastra dev');
    expect(pkg.scripts.dev).toContain('vite');
    expect(pkg.scripts.prebuild).toBeUndefined();
    expect(JSON.stringify(pkg.scripts)).not.toContain('monorepo-deps');
  });

  it('default mode fails when a linked dep is not on npm', () => {
    const failOut = path.join(workDir, 'out-fail');
    const result = runSync(['--out', failOut], { binDir: failingBinDir });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('not published on npm');
    expect(result.stderr).toContain('--skip-verify');
  });

  it('--skip-verify writes caret ranges anyway when deps are not on npm', () => {
    const skipOut = path.join(workDir, 'out-skip');
    const result = runSync(['--out', skipOut, '--skip-verify'], { binDir: failingBinDir });
    expect(result.status).toBe(0);
    const pkg = JSON.parse(fs.readFileSync(path.join(skipOut, 'package.json'), 'utf8'));
    const mastraCore = pkg.dependencies['@mastra/core'];
    expect(mastraCore).toMatch(/^\^/);
    // The peer alias falls back to the caret range too.
    expect(pkg.dependencies['@mastra/memory']).toMatch(/^\^/);
  });

  it('--local-workspace rewrites unpublished deps to file: paths', () => {
    const localOut = path.join(workDir, 'out-local');
    const result = runSync(['--out', localOut, '--local-workspace'], { binDir: failingBinDir });
    expect(result.status).toBe(0);
    const pkg = JSON.parse(fs.readFileSync(path.join(localOut, 'package.json'), 'utf8'));
    // Every mastra dep that came from `link:` should now be a `file:` spec
    // pointing at a real directory inside the monorepo.
    const monorepoRoot = path.resolve(pkgRoot, '../..');
    for (const [name, spec] of Object.entries(pkg.dependencies) as Array<[string, string]>) {
      if (name !== 'mastra' && !name.startsWith('@mastra/')) continue;
      expect(spec, `${name} should be a file: spec under --local-workspace`).toMatch(/^file:/);
      const resolved = path.resolve(localOut, spec.slice('file:'.length));
      expect(fs.existsSync(path.join(resolved, 'package.json')), `${resolved} must exist`).toBe(true);
      // The resolved path must live inside the monorepo — never escape it.
      const rel = path.relative(monorepoRoot, resolved);
      expect(rel.startsWith('..')).toBe(false);
    }
    // Peer alias must not reuse @mastra/core's file: path (which points at
    // packages/core, not packages/memory).
    expect(pkg.dependencies['@mastra/memory']).not.toBe(pkg.dependencies['@mastra/core']);
    expect(pkg.dependencies['@mastra/memory']).toMatch(/^file:/);
  });

  it('rejects --skip-verify combined with --tag', () => {
    const bogusOut = path.join(workDir, 'out-bogus');
    const result = runSync(['--out', bogusOut, '--skip-verify', '--tag', 'latest']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('cannot be combined with --tag');
  });
});
