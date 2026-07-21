/**
 * Unit tests for {@link E2BCodeModeTransport}.
 *
 * These drive the transport against a fake E2B sandbox: we stub the `e2b`
 * files API and the process manager's `spawn`, then feed protocol frames
 * through the captured `onStdout`/`onStderr` callbacks to exercise the
 * done/rpc/timeout/exit paths without a real sandbox.
 */

import { FRAME_PREFIX } from '@mastra/core/tools';
import type { CodeModeRunnerFrame, CodeModeTransport } from '@mastra/core/tools';
import type { ProcessHandle } from '@mastra/core/workspace';
import { describe, it, expect, vi } from 'vitest';
import { E2BSandbox } from '../sandbox';
import { E2BCodeModeTransport } from './transport';

type SpawnOpts = {
  cwd?: string;
  abortSignal?: AbortSignal;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
};

function frame(f: CodeModeRunnerFrame): string {
  return FRAME_PREFIX + JSON.stringify(f) + '\n';
}

interface FakeE2B {
  files: {
    makeDir: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  writes: Array<{ path: string; data: string }>;
}

function makeFakeE2B(): FakeE2B {
  const writes: Array<{ path: string; data: string }> = [];
  return {
    writes,
    files: {
      makeDir: vi.fn().mockResolvedValue(true),
      write: vi.fn((path: string, data: string) => {
        writes.push({ path, data });
        return Promise.resolve();
      }),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  };
}

/**
 * Build a running E2BSandbox with the e2b client and process manager stubbed.
 * `onSpawn` receives the spawn options so a test can drive the process I/O.
 */
function makeSandbox(fakeE2B: FakeE2B, onSpawn: (opts: SpawnOpts) => { handle: ProcessHandle }): E2BSandbox {
  const sandbox = new E2BSandbox({ template: 'test-template' });
  sandbox.status = 'running';
  // Back the `e2b` getter (reads private `_sandbox`) with our fake.
  (sandbox as unknown as { _sandbox: unknown })._sandbox = fakeE2B;
  sandbox.processes.spawn = vi.fn(async (_cmd: string, opts: SpawnOpts = {}) => {
    return onSpawn(opts).handle;
  }) as unknown as E2BSandbox['processes']['spawn'];
  return sandbox;
}

function baseOpts(overrides: Partial<Parameters<CodeModeTransport['run']>[0]> = {}) {
  return {
    program: 'return 1;',
    toolIds: [],
    dispatch: vi.fn().mockResolvedValue(undefined),
    timeout: 5_000,
    ...overrides,
  };
}

describe('E2BCodeModeTransport', () => {
  it('rejects a non-E2B sandbox', async () => {
    const transport = new E2BCodeModeTransport();
    const fakeSandbox = { processes: {}, status: 'running' } as never;
    await expect(transport.run({ sandbox: fakeSandbox, ...baseOpts() })).rejects.toThrow(/requires an E2BSandbox/);
  });

  it('writes stripped JS into the sandbox and returns the program result', async () => {
    const fakeE2B = makeFakeE2B();
    const handle: ProcessHandle = {
      sendStdin: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn(() => new Promise(() => {})), // never exits on its own
      kill: vi.fn().mockResolvedValue(true),
    } as unknown as ProcessHandle;

    const sandbox = makeSandbox(fakeE2B, opts => {
      setTimeout(() => opts.onStdout?.(frame({ type: 'done', ok: true, result: 42 })), 0);
      return { handle };
    });

    const transport = new E2BCodeModeTransport();
    const result = await transport.run({
      sandbox,
      ...baseOpts({ program: 'const x: number = 42;\nreturn x;' }),
    });

    expect(result).toEqual({ success: true, result: 42, logs: [] });
    // Directory created and cleaned up.
    expect(fakeE2B.files.makeDir).toHaveBeenCalledOnce();
    expect(fakeE2B.files.remove).toHaveBeenCalledOnce();
    // Program is TypeScript-stripped before upload: no type annotations remain.
    const programWrite = fakeE2B.writes.find(w => w.path.includes('program-'));
    expect(programWrite).toBeDefined();
    expect(programWrite?.data).not.toContain(': number');
    // Runner references the sandbox-internal path via a file:// URL.
    const runnerWrite = fakeE2B.writes.find(w => w.path.includes('runner-'));
    expect(runnerWrite?.data).toContain('file:///home/user/mastra-code-mode/');
  });

  it('dispatches external tool calls and writes the result back over stdin', async () => {
    const fakeE2B = makeFakeE2B();
    const dispatch = vi.fn().mockResolvedValue({ ok: 'yes' });
    const handle = {
      sendStdin: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn(() => new Promise(() => {})),
      kill: vi.fn().mockResolvedValue(true),
    } as unknown as ProcessHandle;

    const sandbox = makeSandbox(fakeE2B, opts => {
      setTimeout(async () => {
        opts.onStdout?.(frame({ type: 'rpc', id: 0, tool: 'myTool', args: { a: 1 } }));
        // Give the dispatch/respond microtasks a beat, then finish.
        await Promise.resolve();
        opts.onStdout?.(frame({ type: 'done', ok: true, result: 'ok' }));
      }, 0);
      return { handle };
    });

    const transport = new E2BCodeModeTransport();
    const result = await transport.run({
      sandbox,
      ...baseOpts({ toolIds: ['myTool'], dispatch }),
    });

    expect(result.success).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('myTool', { a: 1 });
    const sent = (handle.sendStdin as ReturnType<typeof vi.fn>).mock.calls.map(c => JSON.parse(c[0]));
    expect(sent).toContainEqual({ type: 'rpc-result', id: 0, ok: true, result: { ok: 'yes' } });
  });

  it('rejects a tool that is not on the allow-list', async () => {
    const fakeE2B = makeFakeE2B();
    const dispatch = vi.fn();
    const handle = {
      sendStdin: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn(() => new Promise(() => {})),
      kill: vi.fn().mockResolvedValue(true),
    } as unknown as ProcessHandle;

    const sandbox = makeSandbox(fakeE2B, opts => {
      setTimeout(async () => {
        opts.onStdout?.(frame({ type: 'rpc', id: 1, tool: 'evil', args: {} }));
        await Promise.resolve();
        opts.onStdout?.(frame({ type: 'done', ok: true, result: null }));
      }, 0);
      return { handle };
    });

    const transport = new E2BCodeModeTransport();
    await transport.run({ sandbox, ...baseOpts({ toolIds: ['good'], dispatch }) });

    expect(dispatch).not.toHaveBeenCalled();
    const sent = (handle.sendStdin as ReturnType<typeof vi.fn>).mock.calls.map(c => JSON.parse(c[0]));
    expect(sent[0]).toMatchObject({ type: 'rpc-result', id: 1, ok: false, error: { name: 'NotAllowedError' } });
  });

  it('surfaces stderr when the process exits without a result', async () => {
    const fakeE2B = makeFakeE2B();
    const handle = {
      sendStdin: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue({ exitCode: 1 }),
      kill: vi.fn().mockResolvedValue(true),
    } as unknown as ProcessHandle;

    const sandbox = makeSandbox(fakeE2B, opts => {
      opts.onStderr?.('SyntaxError: boom');
      return { handle };
    });

    const transport = new E2BCodeModeTransport();
    const result = await transport.run({ sandbox, ...baseOpts() });

    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('NoResultError');
    expect(result.error?.message).toContain('SyntaxError: boom');
    expect(fakeE2B.files.remove).toHaveBeenCalledOnce();
  });

  it('times out and surfaces stderr, killing the process', async () => {
    const fakeE2B = makeFakeE2B();
    const handle = {
      sendStdin: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn(() => new Promise(() => {})),
      kill: vi.fn().mockResolvedValue(true),
    } as unknown as ProcessHandle;

    const sandbox = makeSandbox(fakeE2B, opts => {
      opts.onStderr?.('stuck');
      return { handle };
    });

    const transport = new E2BCodeModeTransport();
    const result = await transport.run({ sandbox, ...baseOpts({ timeout: 20 }) });

    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('TimeoutError');
    expect(result.error?.message).toContain('stuck');
    expect(handle.kill).toHaveBeenCalled();
  });

  it('auto-starts the sandbox when it is not running', async () => {
    const fakeE2B = makeFakeE2B();
    const handle = {
      sendStdin: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn(() => new Promise(() => {})),
      kill: vi.fn().mockResolvedValue(true),
    } as unknown as ProcessHandle;

    const sandbox = makeSandbox(fakeE2B, opts => {
      setTimeout(() => opts.onStdout?.(frame({ type: 'done', ok: true, result: 1 })), 0);
      return { handle };
    });
    sandbox.status = 'pending';
    const startSpy = vi.spyOn(sandbox, 'start').mockImplementation(async () => {
      sandbox.status = 'running';
    });

    const transport = new E2BCodeModeTransport();
    const result = await transport.run({ sandbox, ...baseOpts() });

    expect(startSpy).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });
});
