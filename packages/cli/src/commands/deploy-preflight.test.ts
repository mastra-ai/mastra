import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { mergePreflightEnvVars, preflightBuildOutput, printPreflightIssues } from './deploy-preflight.js';
import type { PreflightIssue } from './deploy-preflight.js';

/**
 * `fix` may be a single string or a step list. Tests care about whether the
 * remediation contains a substring, so flatten to one blob for assertions.
 */
const fixText = (fix: PreflightIssue['fix'] | undefined): string => (Array.isArray(fix) ? fix.join('\n') : (fix ?? ''));

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

    it('does not flag AUTO_BLOCK_EXTERNAL_PROVIDERS (read by bundled @mastra/server)', async () => {
      writeBundle(`const f = process.env.AUTO_BLOCK_EXTERNAL_PROVIDERS;`);
      const issues = await preflightBuildOutput(tmpDir, {});
      expect(issues.find(i => i.code === 'MISSING_ENV_VAR')).toBeUndefined();
    });
  });

  describe('LOCAL_STORAGE_PATH', () => {
    function writePreflightMetadata(detections: Array<{ value: string; hint: string; module: string }>) {
      writeFileSync(join(tmpDir, '.mastra', 'output', 'preflight-local-paths.json'), JSON.stringify(detections));
    }

    it('flags detections from bundler metadata as errors', async () => {
      writeBundle(`export {};`);
      writePreflightMetadata([
        {
          value: 'file:./mastra.db',
          hint: 'LibSQL/SQLite file path relative to the build host',
          module: 'src/mastra/index.ts',
        },
      ]);
      const issues = await preflightBuildOutput(tmpDir, {});
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('error');
      expect(issue?.message).toContain('file:./mastra.db');
    });

    it('flags multiple detections from metadata', async () => {
      writeBundle(`export {};`);
      writePreflightMetadata([
        { value: 'file:./mastra.db', hint: 'LibSQL/SQLite file path', module: 'src/mastra/index.ts' },
        { value: 'file:../data.db', hint: 'LibSQL/SQLite file path', module: 'src/mastra/config.ts' },
      ]);
      const issues = await preflightBuildOutput(tmpDir, {});
      const storageIssues = issues.filter(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(storageIssues.length).toBe(2);
    });

    it('reports no issues when metadata file is empty array', async () => {
      writeBundle(`export {};`);
      writePreflightMetadata([]);
      const issues = await preflightBuildOutput(tmpDir, {});
      expect(issues.find(i => i.code === 'LOCAL_STORAGE_PATH')).toBeUndefined();
    });

    it('reports no issues when metadata file is absent (older build)', async () => {
      // Bundle exists but no preflight metadata — plugin wasn't active.
      writeBundle(`const url = 'file:./mastra.db';`);
      const issues = await preflightBuildOutput(tmpDir, {});
      expect(issues.find(i => i.code === 'LOCAL_STORAGE_PATH')).toBeUndefined();
    });

    it('excludes library code by design (agent-builder prompt templates)', async () => {
      // The Rollup plugin only records detections from user modules (not
      // node_modules), so agent-builder prompt templates are never present
      // in the metadata.  An empty metadata array = no false positives.
      writeBundle(`const prompt = "url: 'file:./mastra.db'"; // from agent-builder`);
      writePreflightMetadata([]);
      const issues = await preflightBuildOutput(tmpDir, {});
      expect(issues.find(i => i.code === 'LOCAL_STORAGE_PATH')).toBeUndefined();
    });
  });

  describe('unified preflight-metadata.json', () => {
    function writeLegacyMetadata(detections: Array<{ value: string; hint: string; module: string }>) {
      writeFileSync(join(tmpDir, '.mastra', 'output', 'preflight-local-paths.json'), JSON.stringify(detections));
    }

    function writeMetadata(metadata: {
      version?: number;
      localPaths?: Array<{ value: string; hint: string; module: string; guardedBy?: string }>;
      userEnvRefs?: string[];
    }) {
      writeFileSync(
        join(tmpDir, '.mastra', 'output', 'preflight-metadata.json'),
        JSON.stringify({ version: 1, localPaths: [], userEnvRefs: [], ...metadata }),
      );
    }

    const guardedDetection = {
      value: 'file:./.mastra-demo.db',
      hint: 'LibSQL/SQLite file path relative to the build host',
      module: 'src/constants.ts',
      guardedBy: 'TURSO_DATABASE_URL',
    };

    it('suppresses env-guarded local paths when the guarding var is in the deploy env', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [guardedDetection] });

      const issues = await preflightBuildOutput(tmpDir, { TURSO_DATABASE_URL: 'libsql://x.turso.io' });
      expect(issues.find(i => i.code === 'LOCAL_STORAGE_PATH')).toBeUndefined();
    });

    it('treats an empty-string guard value as missing (runtime || still takes the fallback)', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [guardedDetection] });

      const issues = await preflightBuildOutput(tmpDir, { TURSO_DATABASE_URL: '' }, { hasEnvFile: true });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(issue?.severity).toBe('error');
      expect(issue?.message).toContain('TURSO_DATABASE_URL is not set');
    });

    it('errors with an actionable message when the guarding var is missing and an env file is present', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [guardedDetection] });

      const issues = await preflightBuildOutput(tmpDir, {}, { hasEnvFile: true });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(issue?.severity).toBe('error');
      expect(issue?.message).toContain('file:./.mastra-demo.db will be used at runtime');
      expect(issue?.message).toContain('TURSO_DATABASE_URL is not set');
      expect(fixText(issue?.fix)).toContain('TURSO_DATABASE_URL');
    });

    it('warns (not errors) when the guarding var is missing but the CLI has no env file', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [guardedDetection] });

      const issues = await preflightBuildOutput(tmpDir, {}, { hasEnvFile: false });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(issue?.severity).toBe('warning');
      expect(issue?.message).toContain('cannot verify TURSO_DATABASE_URL is set on the platform');
    });

    it('suppresses paths guarded by platform-provided vars (e.g. MASTRA_STORAGE_URL) without an env entry', async () => {
      writeBundle(`export {};`);
      writeMetadata({
        localPaths: [{ ...guardedDetection, guardedBy: 'MASTRA_STORAGE_URL' }],
      });

      const issues = await preflightBuildOutput(tmpDir, {}, { hasEnvFile: true });
      expect(issues.find(i => i.code === 'LOCAL_STORAGE_PATH')).toBeUndefined();
    });

    it('suppresses guarded paths when the var is present only in platform-stored env vars', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [guardedDetection] });

      const merged = mergePreflightEnvVars({ TURSO_DATABASE_URL: 'libsql://stored.turso.io' }, {});
      const issues = await preflightBuildOutput(tmpDir, merged, { hasEnvFile: true });
      expect(issues.find(i => i.code === 'LOCAL_STORAGE_PATH')).toBeUndefined();
    });

    it('suppresses MISSING_ENV_VAR for vars present only in platform-stored env vars', async () => {
      writeBundle(`export {};`);
      writeMetadata({ userEnvRefs: ['OPENAI_API_KEY'] });

      const merged = mergePreflightEnvVars({ OPENAI_API_KEY: 'sk-stored' }, {});
      const issues = await preflightBuildOutput(tmpDir, merged, { hasEnvFile: true });
      expect(issues.find(i => i.code === 'MISSING_ENV_VAR')).toBeUndefined();
    });

    it('suppresses guarded paths when the var is a platform-managed injection (managedEnvVarNames)', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [guardedDetection] });

      const issues = await preflightBuildOutput(
        tmpDir,
        {},
        { hasEnvFile: true, managedEnvVarNames: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'] },
      );
      expect(issues.find(i => i.code === 'LOCAL_STORAGE_PATH')).toBeUndefined();
    });

    it('suppresses MISSING_ENV_VAR for platform-managed vars (managedEnvVarNames)', async () => {
      writeBundle(`export {};`);
      writeMetadata({ userEnvRefs: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'] });

      const issues = await preflightBuildOutput(
        tmpDir,
        {},
        { hasEnvFile: true, managedEnvVarNames: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'] },
      );
      expect(issues.find(i => i.code === 'MISSING_ENV_VAR')).toBeUndefined();
    });

    it('hard-errors on guarded misses when managedEnvVarNames is present (complete env picture)', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [guardedDetection] });

      // Field present but the guard var is not managed, provided, or stored —
      // the picture is complete even without a local env file.
      const issues = await preflightBuildOutput(tmpDir, {}, { hasEnvFile: false, managedEnvVarNames: [] });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(issue?.severity).toBe('error');
      expect(issue?.message).toContain('TURSO_DATABASE_URL is not set');
    });

    it('names the exact db create command in the hard-error fix (kind-specific)', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [guardedDetection] });

      const issues = await preflightBuildOutput(tmpDir, {}, { hasEnvFile: false, managedEnvVarNames: [] });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(fixText(issue?.fix)).toContain('mastra env db create --kind turso');
    });

    it('renders the DB provisioning fix as a step list so command and env-var options are on separate lines', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [guardedDetection] });

      const issues = await preflightBuildOutput(tmpDir, {}, { hasEnvFile: false, managedEnvVarNames: [] });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(Array.isArray(issue?.fix)).toBe(true);
      const steps = issue?.fix as string[];
      expect(steps[0]).toMatch(/mastra env db create/);
      expect(steps[1]).toMatch(/^Or set TURSO_DATABASE_URL/);
    });

    it('attaches a create-managed-database autofix hint when the guard var maps to a provider', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [guardedDetection] });

      const issues = await preflightBuildOutput(tmpDir, {}, { hasEnvFile: false, managedEnvVarNames: [] });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(issue?.autofix).toEqual({
        kind: 'create-managed-database',
        provider: 'turso',
        envVarName: 'TURSO_DATABASE_URL',
      });
    });

    it('attaches an autofix hint on the hasEnvFile branch too (lint / no platform context)', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [{ ...guardedDetection, guardedBy: 'DATABASE_URL' }] });

      const issues = await preflightBuildOutput(tmpDir, {}, { hasEnvFile: true });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(issue?.autofix).toEqual({
        kind: 'create-managed-database',
        provider: 'neon',
        envVarName: 'DATABASE_URL',
      });
    });

    it('omits the autofix hint when the guard var does not map to a known provider', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [{ ...guardedDetection, guardedBy: 'MY_CUSTOM_DB_URL' }] });

      const issues = await preflightBuildOutput(tmpDir, {}, { hasEnvFile: true });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(issue?.autofix).toBeUndefined();
    });

    it('names the exact db create command when preflight runs without platform context (lint path)', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [{ ...guardedDetection, guardedBy: 'DATABASE_URL' }] });

      const issues = await preflightBuildOutput(tmpDir, {}, { hasEnvFile: true });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(fixText(issue?.fix)).toContain('mastra env db create --kind neon');
    });

    it('omits `mastra env db create` from the remediation when the guard var maps to no known provider', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [{ ...guardedDetection, guardedBy: 'MY_CUSTOM_DB_URL' }] });

      const issues = await preflightBuildOutput(tmpDir, {}, { hasEnvFile: true });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      // Suggesting `mastra env db create` for an arbitrary user-defined var
      // would tell users to spin up managed infra that can't inject their
      // var — a real footgun, not a helpful fallback. The env-var path is
      // the only actionable remediation here.
      expect(fixText(issue?.fix)).not.toContain('mastra env db create');
      expect(fixText(issue?.fix)).toContain('Set MY_CUSTOM_DB_URL');
    });

    it('scopes the db create command to the target environment when a name is provided', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [guardedDetection] });

      const issues = await preflightBuildOutput(
        tmpDir,
        {},
        { hasEnvFile: false, managedEnvVarNames: [], environmentName: 'production' },
      );
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      // Positional arg BEFORE the flag — `mastra env db create` accepts the
      // environment as an argument, not as `--env`.
      expect(fixText(issue?.fix)).toContain('mastra env db create production --kind turso');
    });

    it('does not emit a scoped bare db create command for unmapped guard vars either', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [{ ...guardedDetection, guardedBy: 'MY_CUSTOM_DB_URL' }] });

      // Even with an env name in hand, we don't invent a `mastra env db create
      // staging` remediation for a variable no known provider injects.
      const issues = await preflightBuildOutput(tmpDir, {}, { hasEnvFile: true, environmentName: 'staging' });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(fixText(issue?.fix)).not.toContain('mastra env db create');
    });

    it('warns (not errors) on guarded misses when platform context lacks managedEnvVarNames (older platform)', async () => {
      writeBundle(`export {};`);
      writeMetadata({ localPaths: [guardedDetection] });

      const issues = await preflightBuildOutput(tmpDir, {}, { hasEnvFile: true, managedEnvVarNames: null });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(issue?.severity).toBe('warning');
      expect(issue?.message).toContain('cannot verify whether the platform injects it');
    });

    it('still errors on unguarded local paths', async () => {
      writeBundle(`export {};`);
      writeMetadata({
        localPaths: [{ value: 'file:./mastra.db', hint: 'LibSQL/SQLite file path', module: 'src/mastra/index.ts' }],
      });

      const issues = await preflightBuildOutput(tmpDir, { TURSO_DATABASE_URL: 'libsql://x.turso.io' });
      const issue = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(issue?.severity).toBe('error');
      expect(issue?.message).toContain('file:./mastra.db');
    });

    it('prefers metadata localPaths over the legacy preflight-local-paths.json', async () => {
      writeBundle(`export {};`);
      // Legacy file says error; unified metadata knows the path is guarded.
      writeLegacyMetadata([{ value: 'file:./.mastra-demo.db', hint: 'x', module: 'src/constants.ts' }]);
      writeMetadata({ localPaths: [guardedDetection] });

      const issues = await preflightBuildOutput(tmpDir, { TURSO_DATABASE_URL: 'libsql://x.turso.io' });
      expect(issues.find(i => i.code === 'LOCAL_STORAGE_PATH')).toBeUndefined();
    });

    it('scopes MISSING_ENV_VAR to userEnvRefs — library-only refs in the bundle do not warn', async () => {
      writeBundle(`const libFlag = process.env.SOME_LIBRARY_ONLY_FLAG;`);
      writeMetadata({ userEnvRefs: [] });

      const issues = await preflightBuildOutput(tmpDir, {});
      expect(issues.find(i => i.code === 'MISSING_ENV_VAR')).toBeUndefined();
    });

    it('still warns for user-referenced env vars missing from the deploy env', async () => {
      writeBundle(`export {};`);
      writeMetadata({ userEnvRefs: ['OPENAI_API_KEY', 'TURSO_DATABASE_URL'] });

      const issues = await preflightBuildOutput(tmpDir, { TURSO_DATABASE_URL: 'libsql://x.turso.io' });
      const missing = issues.find(i => i.code === 'MISSING_ENV_VAR');
      expect(missing?.severity).toBe('warning');
      expect(missing?.message).toContain('OPENAI_API_KEY');
      expect(missing?.message).not.toContain('TURSO_DATABASE_URL');
    });

    it('applies the allowlist to userEnvRefs too', async () => {
      writeBundle(`export {};`);
      writeMetadata({ userEnvRefs: ['PORT', 'MASTRA_API_TOKEN'] });

      const issues = await preflightBuildOutput(tmpDir, {});
      expect(issues.find(i => i.code === 'MISSING_ENV_VAR')).toBeUndefined();
    });

    it('falls back to bundle-wide scan + legacy file when metadata is absent (regression guard)', async () => {
      writeBundle(`const k = process.env.ANTHROPIC_API_KEY;`);
      writeLegacyMetadata([{ value: 'file:./mastra.db', hint: 'x', module: 'src/mastra/index.ts' }]);

      const issues = await preflightBuildOutput(tmpDir, {});
      expect(issues.find(i => i.code === 'MISSING_ENV_VAR')?.message).toContain('ANTHROPIC_API_KEY');
      const storage = issues.find(i => i.code === 'LOCAL_STORAGE_PATH');
      expect(storage?.severity).toBe('error');
    });

    it('ignores malformed metadata (wrong version) and falls back', async () => {
      writeBundle(`const k = process.env.ANTHROPIC_API_KEY;`);
      writeFileSync(
        join(tmpDir, '.mastra', 'output', 'preflight-metadata.json'),
        JSON.stringify({ version: 99, nonsense: true }),
      );

      const issues = await preflightBuildOutput(tmpDir, {});
      expect(issues.find(i => i.code === 'MISSING_ENV_VAR')?.message).toContain('ANTHROPIC_API_KEY');
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

describe('mergePreflightEnvVars', () => {
  it('keeps vars present only in the stored environment', () => {
    expect(mergePreflightEnvVars({ TURSO_DATABASE_URL: 'libsql://stored.turso.io' }, {})).toEqual({
      TURSO_DATABASE_URL: 'libsql://stored.turso.io',
    });
  });

  it('lets local env file values win over stored values (mirrors platform merge)', () => {
    expect(mergePreflightEnvVars({ API_KEY: 'stored' }, { API_KEY: 'local' })).toEqual({ API_KEY: 'local' });
  });

  it('lets a blank local value override a stored value (platform request-wins semantics)', () => {
    expect(
      mergePreflightEnvVars({ TURSO_DATABASE_URL: 'libsql://stored.turso.io' }, { TURSO_DATABASE_URL: '' }),
    ).toEqual({
      TURSO_DATABASE_URL: '',
    });
  });

  it('tolerates absent stored env (older platform responses)', () => {
    expect(mergePreflightEnvVars(undefined, { A: '1' })).toEqual({ A: '1' });
    expect(mergePreflightEnvVars(null, { A: '1' })).toEqual({ A: '1' });
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

  it('renders a step-list fix as one arrow line per step', async () => {
    // Reach in via the mocked module so we can inspect what was rendered.
    const clack = await import('@clack/prompts');
    const errorSpy = clack.log.error as unknown as ReturnType<typeof vi.fn>;
    errorSpy.mockClear();

    await printPreflightIssues(
      [
        {
          code: 'LOCAL_STORAGE_PATH',
          severity: 'error',
          message: 'missing DB var',
          fix: ['Run `mastra env db create production --kind turso`', 'Or set TURSO_DATABASE_URL in your env file'],
        },
      ],
      { autoAccept: true },
    );

    // First call to log.error is the issue itself (subsequent call is the
    // summary line). Ensure both step lines land with their own arrow.
    // Strip ANSI so the assertion isn't coupled to picocolors styling.

    const rendered = (errorSpy.mock.calls[0][0] as string).replace(/\x1b\[[0-9;]*m/g, '');
    expect(rendered).toContain('→ Run `mastra env db create production --kind turso`');
    expect(rendered).toContain('→ Or set TURSO_DATABASE_URL in your env file');
    // And they must be on separate lines, not concatenated.
    const arrowLines = rendered.split('\n').filter(l => l.includes('→'));
    expect(arrowLines).toHaveLength(2);
  });
});
