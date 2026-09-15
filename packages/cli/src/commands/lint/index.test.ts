import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { mastraCoreRule } from './rules/mastraCoreRule.js';
import { lint } from './index.js';

vi.mock('@clack/prompts', () => ({
  log: { warn: vi.fn(), error: vi.fn(), step: vi.fn(), success: vi.fn() },
  confirm: vi.fn(),
  select: vi.fn(),
  isCancel: (v: unknown) => v === Symbol.for('clack.cancel'),
}));

vi.mock('@mastra/deployer', () => ({
  getDeployer: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../utils/run-build.js', () => ({
  runBuild: vi.fn(),
}));

describe('lint package inventory', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mastra-lint-inventory-test-'));
    // A real project error prevents these inventory tests from invoking the bundler.
    writeFileSync(join(tmpDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));
    vi.spyOn(mastraCoreRule, 'run');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it.each(['^1.0.0', '1.0.0-alpha.1'])('uses optional declarations and precedence for %s', async version => {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { '@mastra/example': '0.0.1-alpha.1' },
        devDependencies: { '@mastra/example': '^0.0.2' },
        optionalDependencies: {
          '@mastra/core': '^1.0.0',
          '@mastra/example': version,
          mastra: '^1.0.0',
          unrelated: '^1.0.0',
          'mastra-extra': '^1.0.0',
        },
      }),
    );

    const result = await lint({ root: tmpDir });

    expect(result.error).toBeUndefined();
    expect(result.issues.some(issue => issue.code === 'INVALID_TSCONFIG')).toBe(true);
    expect(result.issues.some(issue => issue.code === 'MISSING_MASTRA_CORE')).toBe(false);
    expect(mastraCoreRule.run).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        mastraPackages: [
          { name: '@mastra/example', version, isAlpha: version.includes('alpha') },
          { name: '@mastra/core', version: '^1.0.0', isAlpha: false },
          { name: 'mastra', version: '^1.0.0', isAlpha: false },
        ],
      }),
    );
  });

  it('preserves regular and development inventory without optional declarations', async () => {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { '@mastra/core': '^1.0.0', '@mastra/example': '^1.0.0' },
        devDependencies: { '@mastra/example': '2.0.0-alpha.1', mastra: '^1.0.0' },
      }),
    );

    const result = await lint({ root: tmpDir });

    expect(result.error).toBeUndefined();
    expect(result.issues.some(issue => issue.code === 'INVALID_TSCONFIG')).toBe(true);
    expect(result.issues.some(issue => issue.code === 'MISSING_MASTRA_CORE')).toBe(false);
    expect(mastraCoreRule.run).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        mastraPackages: [
          { name: '@mastra/core', version: '^1.0.0', isAlpha: false },
          { name: '@mastra/example', version: '2.0.0-alpha.1', isAlpha: true },
          { name: 'mastra', version: '^1.0.0', isAlpha: false },
        ],
      }),
    );
  });
});

describe('lint --preflight env file handling', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mastra-lint-preflight-test-'));
    mkdirSync(join(tmpDir, '.mastra', 'output'), { recursive: true });
    // No @mastra/core on purpose: the resulting project error short-circuits
    // the deployer lint step so the test exercises only the preflight path.
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test', dependencies: {} }));
    writeFileSync(join(tmpDir, '.mastra', 'output', 'index.mjs'), `export {};`);
    writeFileSync(
      join(tmpDir, '.mastra', 'output', 'preflight-metadata.json'),
      JSON.stringify({
        version: 1,
        localPaths: [
          {
            value: 'file:./.mastra-demo.db',
            hint: 'LibSQL/SQLite file path relative to the build host',
            module: 'src/constants.ts',
            guardedBy: 'TURSO_DATABASE_URL',
          },
        ],
        userEnvRefs: ['TURSO_DATABASE_URL'],
      }),
    );
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('warns (not errors) on env-guarded local paths when no env file exists', async () => {
    const result = await lint({ root: tmpDir, preflight: true, skipBuild: true, json: true });

    const issue = result.issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('cannot verify TURSO_DATABASE_URL is set on the platform');
  });

  it('errors on env-guarded local paths when an env file exists without the guarding var', async () => {
    writeFileSync(join(tmpDir, '.env'), 'OPENAI_API_KEY=sk-test\n');

    const result = await lint({ root: tmpDir, preflight: true, skipBuild: true, json: true });

    const issue = result.issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('TURSO_DATABASE_URL is not set');
  });

  it('reports no local-path issue when the env file sets the guarding var', async () => {
    writeFileSync(join(tmpDir, '.env'), 'TURSO_DATABASE_URL=libsql://x.turso.io\n');

    const result = await lint({ root: tmpDir, preflight: true, skipBuild: true, json: true });

    expect(result.issues.find(i => i.code === 'LOCAL_STORAGE_PATH')).toBeUndefined();
  });
});
