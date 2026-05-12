import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { preflightBuildOutput, printPreflightIssues } from './deploy-preflight.js';
import type { PreflightIssue } from './deploy-preflight.js';

vi.mock('@clack/prompts', () => ({
  log: { warn: vi.fn(), error: vi.fn() },
  confirm: vi.fn(),
  isCancel: (v: unknown) => v === Symbol.for('clack.cancel'),
}));

describe('preflightBuildOutput', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mastra-preflight-test-'));
    mkdirSync(join(tmpDir, '.mastra', 'output'), { recursive: true });
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test', dependencies: {} }));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeBundle(content: string) {
    writeFileSync(join(tmpDir, '.mastra', 'output', 'index.mjs'), content);
  }

  function writePackageJson(pkg: Record<string, unknown>) {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify(pkg));
  }

  it('returns no issues when build output is missing', async () => {
    rmSync(join(tmpDir, '.mastra'), { recursive: true, force: true });
    const issues = await preflightBuildOutput(tmpDir, {});
    expect(issues).toEqual([]);
  });

  it('returns no issues for a clean bundle', async () => {
    writeBundle(`import { Mastra } from 'mastra';\nconst port = process.env.PORT;\nexport default new Mastra({});`);
    writePackageJson({ name: 'test', dependencies: { mastra: '*' } });

    const issues = await preflightBuildOutput(tmpDir, {});
    expect(issues).toEqual([]);
  });

  describe('MISSING_ENV_VAR', () => {
    it('flags env vars referenced in code but missing from env file', async () => {
      writeBundle(`const k = process.env.ANTHROPIC_API_KEY;\nconst u = process.env.DATABASE_URL;`);

      const issues = await preflightBuildOutput(tmpDir, {});
      const missing = issues.find(i => i.code === 'MISSING_ENV_VAR');
      expect(missing).toBeDefined();
      expect(missing?.severity).toBe('warning');
      expect(missing?.message).toContain('ANTHROPIC_API_KEY');
      expect(missing?.message).toContain('DATABASE_URL');
    });

    it('does not flag env vars present in the env file', async () => {
      writeBundle(`const k = process.env.ANTHROPIC_API_KEY;`);
      const issues = await preflightBuildOutput(tmpDir, { ANTHROPIC_API_KEY: 'sk-x' });
      expect(issues.find(i => i.code === 'MISSING_ENV_VAR')).toBeUndefined();
    });

    it('does not flag platform-set env vars (PORT, NODE_ENV, MASTRA_*)', async () => {
      writeBundle(`
        const port = process.env.PORT;
        const env = process.env.NODE_ENV;
        const mst = process.env.MASTRA_API_TOKEN;
        const otel = process.env.OTEL_SERVICE_NAME;
      `);
      const issues = await preflightBuildOutput(tmpDir, {});
      expect(issues.find(i => i.code === 'MISSING_ENV_VAR')).toBeUndefined();
    });

    it('does not flag framework-internal sentinel env vars from bundled deps', async () => {
      writeBundle(`
        const dbg = process.env.DEBUG;
        const fd = process.env.DEBUG_FD;
        const exp = process.env.EXPERIMENTAL_FEATURES;
        const om = process.env.OM_DEBUG;
        const omRepro = process.env.OM_REPRO_CAPTURE;
        const skills = process.env.SKILLS_BASE_DIR;
        const noColor = process.env.NO_COLOR;
        const force = process.env.FORCE_COLOR;
      `);
      const issues = await preflightBuildOutput(tmpDir, {});
      expect(issues.find(i => i.code === 'MISSING_ENV_VAR')).toBeUndefined();
    });

    it('detects bracket-notation references', async () => {
      writeBundle(`const k = process.env['STRIPE_KEY'];`);
      const issues = await preflightBuildOutput(tmpDir, {});
      const missing = issues.find(i => i.code === 'MISSING_ENV_VAR');
      expect(missing?.message).toContain('STRIPE_KEY');
    });
  });

  describe('LOCAL_STORAGE_PATH', () => {
    it('flags file:./*.db LibSQL paths as errors', async () => {
      writeBundle(`const url = 'file:./mastra.db';`);
      const issues = await preflightBuildOutput(tmpDir, {});
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('error');
      expect(issue?.message).toContain('file:./mastra.db');
    });

    it('flags localhost in connection strings', async () => {
      writeBundle(`const pg = 'postgresql://user:pass@localhost:5432/db';`);
      const issues = await preflightBuildOutput(tmpDir, {});
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('error');
    });

    it('flags 127.0.0.1 in connection strings', async () => {
      writeBundle(`const r = 'redis://127.0.0.1:6379';`);
      const issues = await preflightBuildOutput(tmpDir, {});
      expect(issues.find(i => i.code === 'LOCAL_STORAGE_PATH')).toBeDefined();
    });

    it('does not flag hosted libsql:// URLs', async () => {
      writeBundle(`const url = 'libsql://my-db-acme.turso.io';`);
      const issues = await preflightBuildOutput(tmpDir, {});
      expect(issues.find(i => i.code === 'LOCAL_STORAGE_PATH')).toBeUndefined();
    });

    it('does not flag the word "localhost" in unrelated strings', async () => {
      writeBundle(`const msg = 'You can run this on localhost too';`);
      const issues = await preflightBuildOutput(tmpDir, {});
      expect(issues.find(i => i.code === 'LOCAL_STORAGE_PATH')).toBeUndefined();
    });
  });

  it('scans nested .mjs files in the output directory', async () => {
    writeBundle(`export {};`);
    const subDir = join(tmpDir, '.mastra', 'output', 'chunks');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, 'chunk-1.mjs'), `const k = process.env.SECRET_KEY;`);

    const issues = await preflightBuildOutput(tmpDir, {});
    const missing = issues.find(i => i.code === 'MISSING_ENV_VAR');
    expect(missing?.message).toContain('SECRET_KEY');
  });
});

describe('printPreflightIssues', () => {
  const errorIssue: PreflightIssue = {
    code: 'LOCAL_STORAGE_PATH',
    severity: 'error',
    message: 'local sqlite path',
    fix: 'use a hosted url',
  };
  const warningIssue: PreflightIssue = {
    code: 'MISSING_ENV_VAR',
    severity: 'warning',
    message: 'missing FOO',
    fix: 'add it to .env',
  };

  it('returns ok when there are no issues', async () => {
    const result = await printPreflightIssues([], { autoAccept: true });
    expect(result).toBe('ok');
  });

  it('returns blocked on errors even with autoAccept (--yes)', async () => {
    const result = await printPreflightIssues([errorIssue], { autoAccept: true });
    expect(result).toBe('blocked');
  });

  it('returns blocked on errors mixed with warnings under autoAccept', async () => {
    const result = await printPreflightIssues([errorIssue, warningIssue], { autoAccept: true });
    expect(result).toBe('blocked');
  });

  it('returns ok for warnings-only under autoAccept', async () => {
    const result = await printPreflightIssues([warningIssue], { autoAccept: true });
    expect(result).toBe('ok');
  });
});
