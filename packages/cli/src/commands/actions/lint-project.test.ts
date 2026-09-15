import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: { warn: vi.fn(), error: vi.fn(), success: vi.fn(), step: vi.fn(), info: vi.fn() },
  confirm: vi.fn(),
  isCancel: (v: unknown) => v === Symbol.for('clack.cancel'),
  select: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('../../utils/run-build.js', () => ({
  runBuild: vi.fn(),
}));

vi.mock('../..', () => ({
  analytics: {
    trackCommandExecution: async ({ execution }: { execution: () => Promise<unknown> }) => execution(),
  },
  origin: undefined,
}));

import { runBuild } from '../../utils/run-build.js';
import { lintProject } from './lint-project.js';

const runBuildMock = vi.mocked(runBuild);

describe('lintProject', () => {
  let tmpDir: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mastra-lint-test-'));
    mkdirSync(join(tmpDir, '.mastra', 'output'), { recursive: true });
    mkdirSync(join(tmpDir, 'src', 'mastra'), { recursive: true });
    writeFileSync(join(tmpDir, 'src', 'mastra', 'index.ts'), 'export const mastra = {};');
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', dependencies: { '@mastra/core': '1.0.0' } }),
    );
    writeFileSync(join(tmpDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { moduleResolution: 'bundler' } }));

    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    exitSpy.mockRestore();
    stdoutSpy.mockRestore();
    vi.clearAllMocks();
  });

  function writeBundle(content: string) {
    writeFileSync(join(tmpDir, '.mastra', 'output', 'index.mjs'), content);
  }

  function writeEnv(content: string) {
    writeFileSync(join(tmpDir, '.env'), content);
  }

  it('does not run preflight or build by default', async () => {
    await expect(lintProject({ root: tmpDir })).resolves.toBeUndefined();

    expect(runBuildMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('passes with zero issues when preflight finds no issues', async () => {
    writeBundle(`export default {};`);
    writeEnv('OTHER=value\n');

    await expect(lintProject({ root: tmpDir, preflight: true, skipBuild: true })).resolves.toBeUndefined();

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('builds before preflight unless --skip-build is set, even when output exists', async () => {
    writeBundle(`export default {};`);
    writeEnv('OTHER=value\n');

    await expect(lintProject({ root: tmpDir, preflight: true })).resolves.toBeUndefined();

    expect(runBuildMock).toHaveBeenCalledWith(tmpDir, { debug: undefined });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('passes with warnings when preflight finds missing env vars in non-strict mode', async () => {
    writeBundle(`const x = process.env.MY_KEY; export default x;`);
    writeEnv('OTHER=value\n');

    await expect(lintProject({ root: tmpDir, preflight: true, skipBuild: true })).resolves.toBeUndefined();

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits 1 in --strict mode when preflight only finds warnings', async () => {
    writeBundle(`const x = process.env.MY_MISSING_VAR; export default x;`);
    writeEnv('OTHER=value\n');

    await expect(lintProject({ root: tmpDir, preflight: true, skipBuild: true, strict: true })).rejects.toThrow(
      'process.exit(1)',
    );
  });

  it('emits JSON output for preflight issues', async () => {
    writeBundle(`const x = process.env.MY_MISSING_VAR; export default x;`);
    writeEnv('OTHER=value\n');

    await expect(lintProject({ root: tmpDir, preflight: true, skipBuild: true, json: true })).resolves.toBeUndefined();

    const calls = stdoutSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const jsonOutput = calls.find((c: string) => c.trim().startsWith('{'));
    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput!);
    expect(parsed.ok).toBe(true);
    expect(parsed.warningCount).toBeGreaterThan(0);
    expect(parsed.issues[0]).toMatchObject({ code: 'MISSING_ENV_VAR', scope: 'bundle' });
  });

  it('runs preflight without an env file, reporting warnings instead of failing', async () => {
    // Env vars may live on the platform (e.g. CI without a checked-in .env),
    // so a missing env file must not hard-fail — issues soften to warnings.
    writeBundle(`const x = process.env.MY_MISSING_VAR; export default x;`);

    await expect(lintProject({ root: tmpDir, preflight: true, skipBuild: true, json: true })).resolves.toBeUndefined();

    const calls = stdoutSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const jsonOutput = calls.find((c: string) => c.trim().startsWith('{'));
    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput!);
    expect(parsed.ok).toBe(true);
    expect(parsed.warningCount).toBeGreaterThan(0);
    expect(parsed.issues[0]).toMatchObject({ code: 'MISSING_ENV_VAR', scope: 'bundle' });
  });

  it('emits project-phase issues as structured JSON', async () => {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test', dependencies: {} }));

    await expect(lintProject({ root: tmpDir, json: true })).rejects.toThrow('process.exit(1)');

    const calls = stdoutSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const jsonOutput = calls.find((c: string) => c.trim().startsWith('{'));
    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput!);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues[0]).toMatchObject({ code: 'MISSING_MASTRA_CORE', scope: 'project' });
  });
});
