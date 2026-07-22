import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Validates the output of scripts/sync-template.mjs — the artifact users
 * actually receive. Runs the real script with no network dependency: the
 * script no longer shells out to npm, so the emitted template is entirely
 * derived from local monorepo state.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const webRoot = path.resolve(pkgRoot, '../web');
const script = path.join(pkgRoot, 'scripts', 'sync-template.mjs');

let workDir: string;
let outDir: string;
let sentinel: string;

function runSync(args: string[]): { status: number; stderr: string } {
  try {
    execFileSync(process.execPath, [script, ...args], { stdio: 'pipe' });
    return { status: 0, stderr: '' };
  } catch (err) {
    const e = err as { status?: number; stderr?: Buffer };
    return { status: e.status ?? 1, stderr: e.stderr?.toString() ?? '' };
  }
}

beforeAll(() => {
  workDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sf-sync-test-')));
  outDir = path.join(workDir, 'out');

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

    // package.json: monorepo coupling removed; every Mastra dep pins `alpha`.
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, 'package.json'), 'utf8'));
    const allDeps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, spec] of Object.entries(allDeps)) {
      expect(spec, `${name} must not use a link:/workspace: spec`).not.toMatch(/^(link|workspace|catalog|file):/);
      if (name === 'mastra' || name.startsWith('@mastra/')) {
        expect(spec, `${name} must be pinned to "alpha"`).toBe('alpha');
      }
    }
    expect(pkg.dependencies['@mastra/memory']).toBe('alpha');
    // While the Mastra deps float on `alpha`, `.npmrc` needs
    // `legacy-peer-deps=true` so npm accepts the internally-consistent
    // prerelease peer graph. Remove once the packages ship stable versions
    // and the template pins `"latest"` again.
    const npmrc = fs.readFileSync(path.join(outDir, '.npmrc'), 'utf8');
    expect(npmrc).toMatch(/^legacy-peer-deps\s*=\s*true\s*$/m);

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
});
