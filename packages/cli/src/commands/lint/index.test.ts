import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

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
