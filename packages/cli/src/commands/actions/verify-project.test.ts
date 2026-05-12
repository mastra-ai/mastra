import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock @clack/prompts so log/intro/outro are noop and we don't fork stdout.
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: { warn: vi.fn(), error: vi.fn(), success: vi.fn(), step: vi.fn() },
  confirm: vi.fn(),
  isCancel: (v: unknown) => v === Symbol.for('clack.cancel'),
  select: vi.fn(),
  cancel: vi.fn(),
}));

// Skip the real build step — `verify --skip-build` is what we exercise in tests.
vi.mock('../../utils/run-build.js', () => ({
  runBuild: vi.fn(),
}));

// Avoid hitting posthog during tests.
vi.mock('../..', () => ({
  analytics: {
    trackCommandExecution: async ({ execution }: { execution: () => Promise<unknown> }) => execution(),
  },
  origin: undefined,
}));

import { verifyProject } from './verify-project.js';

describe('verifyProject', () => {
  let tmpDir: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mastra-verify-test-'));
    mkdirSync(join(tmpDir, '.mastra', 'output'), { recursive: true });
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test', dependencies: {} }));

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

  it('passes silently when the bundle has no issues', async () => {
    writeBundle(`const x = process.env.MY_KEY; export default x;`);
    writeEnv('MY_KEY=value\n');

    await expect(verifyProject({ dir: tmpDir, skipBuild: true })).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('passes with warnings when missing env vars are detected (non-strict)', async () => {
    writeBundle(`const x = process.env.MY_KEY; export default x;`);
    writeEnv('OTHER=value\n');

    await expect(verifyProject({ dir: tmpDir, skipBuild: true })).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits 1 when an error-severity issue is found', async () => {
    // Local storage path = error severity
    writeBundle(`const url = "file:./local/db.sqlite"; export default url;`);
    writeEnv('FOO=bar\n');

    await expect(verifyProject({ dir: tmpDir, skipBuild: true })).rejects.toThrow('process.exit(1)');
  });

  it('exits 1 in --strict mode when only warnings are present', async () => {
    writeBundle(`const x = process.env.MY_MISSING_VAR; export default x;`);
    writeEnv('OTHER=value\n');

    await expect(verifyProject({ dir: tmpDir, skipBuild: true, strict: true })).rejects.toThrow('process.exit(1)');
  });

  it('emits JSON output when --json is passed', async () => {
    writeBundle(`const x = process.env.MY_MISSING_VAR; export default x;`);
    writeEnv('OTHER=value\n');

    await expect(verifyProject({ dir: tmpDir, skipBuild: true, json: true })).resolves.toBeUndefined();

    const calls = stdoutSpy.mock.calls.map(c => String(c[0]));
    const jsonOutput = calls.find(c => c.trim().startsWith('{'));
    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput!);
    expect(parsed.ok).toBe(true);
    expect(parsed.warningCount).toBeGreaterThan(0);
    expect(Array.isArray(parsed.issues)).toBe(true);
  });

  it('emits JSON with ok=false and exits 1 when blocked in --json mode', async () => {
    writeBundle(`const url = "file:./local/db.sqlite"; export default url;`);
    writeEnv('FOO=bar\n');

    await expect(verifyProject({ dir: tmpDir, skipBuild: true, json: true })).rejects.toThrow('process.exit(1)');

    const calls = stdoutSpy.mock.calls.map(c => String(c[0]));
    const jsonOutput = calls.find(c => c.trim().startsWith('{'));
    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput!);
    expect(parsed.ok).toBe(false);
    expect(parsed.errorCount).toBeGreaterThan(0);
  });

  it('emits JSON error and exits 1 when no env file is found', async () => {
    writeBundle(`export default 1;`);
    // intentionally no .env file written

    await expect(verifyProject({ dir: tmpDir, skipBuild: true, json: true })).rejects.toThrow('process.exit(1)');

    const calls = stdoutSpy.mock.calls.map(c => String(c[0]));
    const jsonOutput = calls.find(c => c.trim().startsWith('{'));
    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput!);
    expect(parsed).toMatchObject({
      ok: false,
      strict: false,
      errorCount: 0,
      warningCount: 0,
      issues: [],
    });
    expect(parsed.error).toMatch(/env file/i);
  });
});
