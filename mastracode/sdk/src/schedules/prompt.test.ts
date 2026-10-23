import { describe, expect, it, vi } from 'vitest';
import { assembleSchedulePrompt, formatScriptOutput, SCRIPT_TIMEOUT_MS } from './prompt.js';

const cwd = '/work';

function options(overrides: Partial<Parameters<typeof assembleSchedulePrompt>[1]> = {}) {
  return {
    cwd,
    runScript: vi.fn(async () => ({ stdout: 'OK\n', stderr: '', exitCode: 0 })),
    readFile: vi.fn(async () => 'file prompt\n'),
    ...overrides,
  };
}

describe('formatScriptOutput', () => {
  it('labels output with the path and exit code', () => {
    expect(formatScriptOutput('./c.sh', { stdout: 'a\n', stderr: 'b\n', exitCode: 2 })).toBe(
      'Output of ./c.sh (exit 2):\na\nb',
    );
  });

  it('marks empty output and timeouts', () => {
    expect(formatScriptOutput('./c.sh', { stdout: '', stderr: '', exitCode: null })).toBe(
      'Output of ./c.sh (exit null):\n(no output)',
    );
  });
});

describe('assembleSchedulePrompt', () => {
  it('returns a plain prompt unchanged', async () => {
    const opts = options();
    await expect(assembleSchedulePrompt({ prompt: 'check deploy' }, opts)).resolves.toEqual({ prompt: 'check deploy' });
    expect(opts.runScript).not.toHaveBeenCalled();
  });

  it('runs exec files in the workspace and appends the extra prompt', async () => {
    const opts = options();
    const prompt = await assembleSchedulePrompt(
      { file: { path: '/work/check.sh', displayPath: './check.sh', mode: 'script' }, extraPrompt: 'Report it' },
      opts,
    );
    expect(prompt).toEqual({ prompt: 'Output of ./check.sh (exit 0):\nOK\n\nReport it', outcome: 'exit 0' });
    expect(opts.runScript).toHaveBeenCalledWith('/work/check.sh', { cwd, timeoutMs: SCRIPT_TIMEOUT_MS });
  });

  it('reads prompt files on every call', async () => {
    const readFile = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const spec = { file: { path: '/work/p.md', displayPath: './p.md', mode: 'prompt' as const } };
    await expect(assembleSchedulePrompt(spec, options({ readFile }))).resolves.toEqual({ prompt: 'first' });
    await expect(assembleSchedulePrompt(spec, options({ readFile }))).resolves.toEqual({ prompt: 'second' });
  });

  it('turns failures into prompt text instead of skipping', async () => {
    const prompt = await assembleSchedulePrompt(
      { file: { path: '/work/gone.sh', displayPath: './gone.sh', mode: 'script' }, extraPrompt: 'Report it' },
      options({ runScript: vi.fn(async () => Promise.reject(new Error('ENOENT'))) }),
    );
    expect(prompt).toEqual({ prompt: 'Schedule ./gone.sh failed: ENOENT\n\nReport it', outcome: 'failed' });
  });

  it('reports killed scripts', async () => {
    const result = await assembleSchedulePrompt(
      { file: { path: '/work/slow.sh', displayPath: './slow.sh', mode: 'script' } },
      options({ runScript: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: null })) }),
    );
    expect(result.outcome).toBe('killed');
  });
});
