import { describe, expect, it, vi } from 'vitest';

import type { LoggerContext, MetricsContext, ObservabilityInstance, WorkspaceActivityEvent } from '../observability';
import type { WorkspaceFilesystem } from './filesystem/filesystem';
import type { WorkspaceSandbox } from './sandbox/sandbox';
import type { WorkspaceInstrumentationMeta } from './observability';
import { SANDBOX_OUTPUT_CHUNK_LIMIT, truncateChunk, wrapFilesystem, wrapSandbox } from './observability';

/**
 * Minimal `ObservabilityInstance` stub. Records every call so tests can assert
 * on metrics, logs, and workspace_activity events without pulling in the full
 * `@mastra/observability` runtime.
 */
function makeObservabilityStub() {
  const metrics: Array<{ name: string; value: number; labels?: Record<string, unknown> }> = [];
  const logs: Array<{ level: 'info' | 'error'; message: string; data?: Record<string, unknown> }> = [];
  const activity: WorkspaceActivityEvent[] = [];

  const logger: LoggerContext = {
    debug: vi.fn(),
    info: vi.fn((message: string, data?: Record<string, unknown>) => {
      logs.push({ level: 'info', message, data });
    }),
    warn: vi.fn(),
    error: vi.fn((message: string, data?: Record<string, unknown>) => {
      logs.push({ level: 'error', message, data });
    }),
    fatal: vi.fn(),
  };

  const metricsCtx: MetricsContext = {
    emit(name: string, value: number, labels?: Record<string, unknown>) {
      metrics.push({ name, value, labels });
    },
  } as unknown as MetricsContext;

  const instance: ObservabilityInstance = {
    getConfig: () => ({}) as any,
    getExporters: () => [],
    getSpanOutputProcessors: () => [],
    getLogger: () => ({}) as any,
    getBridge: () => undefined,
    startSpan: () => ({}) as any,
    rebuildSpan: () => ({}) as any,
    flush: async () => {},
    shutdown: async () => {},
    __setLogger: () => {},
    getLoggerContext: () => logger,
    getMetricsContext: () => metricsCtx,
    emitWorkspaceActivityEvent: (event: WorkspaceActivityEvent) => {
      activity.push(event);
    },
  };

  return { instance, metrics, logs, activity };
}

const META: WorkspaceInstrumentationMeta = {
  workspaceId: 'ws-1',
  workspaceName: 'test-workspace',
};

// =============================================================================
// truncateChunk
// =============================================================================

describe('truncateChunk', () => {
  it('returns short strings unchanged with truncated:false', () => {
    const result = truncateChunk('hello world');
    expect(result).toEqual({ chunk: 'hello world', truncated: false });
  });

  it('truncates strings longer than the limit and sets truncated:true', () => {
    const big = 'a'.repeat(SANDBOX_OUTPUT_CHUNK_LIMIT + 100);
    const result = truncateChunk(big);
    expect(result.chunk.length).toBe(SANDBOX_OUTPUT_CHUNK_LIMIT);
    expect(result.truncated).toBe(true);
  });

  it('accepts Buffer inputs and decodes as utf-8', () => {
    const result = truncateChunk(Buffer.from('hello', 'utf8'));
    expect(result).toEqual({ chunk: 'hello', truncated: false });
  });

  it('respects a custom limit', () => {
    const result = truncateChunk('abcdef', 3);
    expect(result).toEqual({ chunk: 'abc', truncated: true });
  });
});

// =============================================================================
// wrapFilesystem
// =============================================================================

/** Fake filesystem — bare minimum surface needed for the wrapper. */
function makeFakeFilesystem(overrides: Partial<WorkspaceFilesystem> = {}): WorkspaceFilesystem {
  const fs: Partial<WorkspaceFilesystem> = {
    id: 'fs-1',
    name: 'test-fs',
    provider: 'local',
    readFile: vi.fn(async (_path: string) => 'file-contents'),
    writeFile: vi.fn(async (_path: string, _content: unknown) => undefined),
    appendFile: vi.fn(async (_path: string, _content: unknown) => undefined),
    deleteFile: vi.fn(async (_path: string) => undefined),
    copyFile: vi.fn(async (_src: string, _dest: string) => undefined),
    moveFile: vi.fn(async (_src: string, _dest: string) => undefined),
    mkdir: vi.fn(async (_path: string) => undefined),
    rmdir: vi.fn(async (_path: string) => undefined),
    readdir: vi.fn(async (_path: string) => [{ name: 'a', isDirectory: false } as any]),
    stat: vi.fn(async (_path: string) => ({ size: 5 }) as any),
    exists: vi.fn(async (_path: string) => true),
    ...overrides,
  };
  return fs as WorkspaceFilesystem;
}

describe('wrapFilesystem', () => {
  it('passes through call args and returns provider result unchanged', async () => {
    const { instance } = makeObservabilityStub();
    const fs = makeFakeFilesystem();
    const wrapped = wrapFilesystem(fs, META, instance);

    const result = await wrapped.readFile('/foo.txt');
    expect(result).toBe('file-contents');
    expect(fs.readFile).toHaveBeenCalledWith('/foo.txt');
  });

  it('emits a duration_ms metric and info log on success', async () => {
    const { instance, metrics, logs } = makeObservabilityStub();
    const fs = makeFakeFilesystem();
    const wrapped = wrapFilesystem(fs, META, instance);

    await wrapped.readFile('/foo.txt');

    const durationMetric = metrics.find(m => m.name === 'mastra.workspace.filesystem.duration_ms');
    expect(durationMetric).toBeDefined();
    expect(durationMetric?.labels).toMatchObject({ operation: 'readFile', provider: 'local', success: 'true' });

    const infoLog = logs.find(l => l.level === 'info' && l.message === 'workspace.filesystem.readFile');
    expect(infoLog).toBeDefined();
    expect(infoLog?.data).toMatchObject({ provider: 'local', path: '/foo.txt' });
  });

  it('emits filesystem_change ONLY on mutating operations', async () => {
    const { instance, activity } = makeObservabilityStub();
    const fs = makeFakeFilesystem();
    const wrapped = wrapFilesystem(fs, META, instance);

    // Reads must NOT emit an activity event.
    await wrapped.readFile('/foo.txt');
    await wrapped.readdir('/');
    await wrapped.stat('/foo.txt');
    expect(activity).toHaveLength(0);

    // Mutations MUST emit an activity event.
    await wrapped.writeFile('/foo.txt', 'hello');
    await wrapped.appendFile('/foo.txt', 'world');
    await wrapped.deleteFile('/foo.txt');
    await wrapped.copyFile('/foo.txt', '/bar.txt');
    await wrapped.moveFile('/bar.txt', '/baz.txt');
    await wrapped.mkdir('/dir');
    await wrapped.rmdir('/dir');

    const ops = activity.map(e => (e.type === 'filesystem_change' ? e.change.operation : e.type));
    expect(ops).toEqual(['write', 'append', 'delete', 'copy', 'move', 'mkdir', 'rmdir']);
  });

  it('uses destination path on copy/move filesystem_change events', async () => {
    const { instance, activity } = makeObservabilityStub();
    const fs = makeFakeFilesystem();
    const wrapped = wrapFilesystem(fs, META, instance);

    await wrapped.copyFile('/src', '/dst');
    const copyEvent = activity[0];
    expect(copyEvent?.type).toBe('filesystem_change');
    if (copyEvent?.type === 'filesystem_change') {
      expect(copyEvent.change.path).toBe('/dst');
      expect(copyEvent.change.operation).toBe('copy');
    }
  });

  it('never carries file contents on filesystem_change events', async () => {
    const { instance, activity } = makeObservabilityStub();
    const fs = makeFakeFilesystem();
    const wrapped = wrapFilesystem(fs, META, instance);

    await wrapped.writeFile('/secret.txt', 'super-secret-contents');

    const change = activity[0];
    expect(change?.type).toBe('filesystem_change');
    // The event object shape must not contain any content-carrying field.
    if (change?.type === 'filesystem_change') {
      const serialized = JSON.stringify(change);
      expect(serialized).not.toContain('super-secret-contents');
    }
  });

  it('emits an errors_total metric and error log when the provider throws, then rethrows', async () => {
    const { instance, metrics, logs } = makeObservabilityStub();
    const boom = new Error('kaboom');
    const fs = makeFakeFilesystem({
      readFile: vi.fn(async () => {
        throw boom;
      }),
    });
    const wrapped = wrapFilesystem(fs, META, instance);

    await expect(wrapped.readFile('/foo.txt')).rejects.toBe(boom);

    const errorMetric = metrics.find(m => m.name === 'mastra.workspace.filesystem.errors_total');
    expect(errorMetric).toBeDefined();
    expect(errorMetric?.value).toBe(1);
    expect(errorMetric?.labels).toMatchObject({ operation: 'readFile', provider: 'local' });

    const errorLog = logs.find(l => l.level === 'error');
    expect(errorLog?.message).toBe('workspace.filesystem.readFile');
  });

  it('reports read byte count when readFile returns a string', async () => {
    const { instance, metrics } = makeObservabilityStub();
    const fs = makeFakeFilesystem({
      readFile: vi.fn(async () => 'hello'),
    });
    const wrapped = wrapFilesystem(fs, META, instance);

    await wrapped.readFile('/foo.txt');

    const bytesMetric = metrics.find(m => m.name === 'mastra.workspace.filesystem.bytes');
    expect(bytesMetric).toBeDefined();
    expect(bytesMetric?.value).toBe(5);
    expect(bytesMetric?.labels).toMatchObject({ operation: 'readFile', direction: 'read' });
  });

  it('leaves non-instrumented properties untouched', () => {
    const { instance } = makeObservabilityStub();
    const fs = makeFakeFilesystem();
    const wrapped = wrapFilesystem(fs, META, instance);

    expect(wrapped.id).toBe('fs-1');
    expect(wrapped.name).toBe('test-fs');
    expect(wrapped.provider).toBe('local');
  });
});

// =============================================================================
// wrapSandbox
// =============================================================================

function makeFakeSandbox(overrides: Partial<WorkspaceSandbox> = {}): WorkspaceSandbox {
  const sb: Partial<WorkspaceSandbox> = {
    id: 'sb-1',
    name: 'test-sb',
    provider: 'local',
    executeCommand: vi.fn(async (_command: string) => ({
      success: true,
      exitCode: 0,
      stdout: 'ok\n',
      stderr: '',
      executionTimeMs: 5,
    })),
    isReady: vi.fn(async () => true),
    getInfo: vi.fn(async () => ({ status: 'ready' }) as any),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    destroy: vi.fn(async () => undefined),
    ...overrides,
  };
  return sb as WorkspaceSandbox;
}

describe('wrapSandbox', () => {
  it('emits duration + info log + stdout activity event on executeCommand', async () => {
    const { instance, metrics, logs, activity } = makeObservabilityStub();
    const sb = makeFakeSandbox();
    const wrapped = wrapSandbox(sb, META, instance);

    const result = await wrapped.executeCommand!('echo hello');
    expect(result?.exitCode).toBe(0);

    expect(metrics.some(m => m.name === 'mastra.workspace.sandbox.duration_ms')).toBe(true);
    expect(logs.some(l => l.level === 'info' && l.message === 'workspace.sandbox.executeCommand')).toBe(true);

    const outputs = activity.filter(e => e.type === 'sandbox_output');
    expect(outputs).toHaveLength(1);
    if (outputs[0]?.type === 'sandbox_output') {
      expect(outputs[0].output.source).toBe('exec');
      expect(outputs[0].output.stream).toBe('stdout');
      expect(outputs[0].output.chunk).toBe('ok\n');
      expect(outputs[0].output.truncated).toBe(false);
    }
  });

  it('emits both stdout AND stderr activity events when both non-empty', async () => {
    const { instance, activity } = makeObservabilityStub();
    const sb = makeFakeSandbox({
      executeCommand: vi.fn(async () => ({
        success: false,
        exitCode: 1,
        stdout: 'out',
        stderr: 'err',
        executionTimeMs: 1,
      })),
    });
    const wrapped = wrapSandbox(sb, META, instance);

    await wrapped.executeCommand!('cmd');

    const outputs = activity.filter(e => e.type === 'sandbox_output');
    expect(outputs).toHaveLength(2);
    const streams = outputs.map(e => (e.type === 'sandbox_output' ? e.output.stream : ''));
    expect(streams).toEqual(expect.arrayContaining(['stdout', 'stderr']));
  });

  it('does not emit sandbox_output for empty streams', async () => {
    const { instance, activity } = makeObservabilityStub();
    const sb = makeFakeSandbox({
      executeCommand: vi.fn(async () => ({
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
        executionTimeMs: 1,
      })),
    });
    const wrapped = wrapSandbox(sb, META, instance);

    await wrapped.executeCommand!('cmd');
    expect(activity).toHaveLength(0);
  });

  it('truncates oversized stdout chunks and marks truncated:true', async () => {
    const { instance, activity } = makeObservabilityStub();
    const big = 'a'.repeat(SANDBOX_OUTPUT_CHUNK_LIMIT + 500);
    const sb = makeFakeSandbox({
      executeCommand: vi.fn(async () => ({
        success: true,
        exitCode: 0,
        stdout: big,
        stderr: '',
        executionTimeMs: 1,
      })),
    });
    const wrapped = wrapSandbox(sb, META, instance);

    await wrapped.executeCommand!('cmd');
    const output = activity[0];
    expect(output?.type).toBe('sandbox_output');
    if (output?.type === 'sandbox_output') {
      expect(output.output.chunk.length).toBe(SANDBOX_OUTPUT_CHUNK_LIMIT);
      expect(output.output.truncated).toBe(true);
    }
  });

  it('rethrows and emits errors_total when executeCommand throws', async () => {
    const { instance, metrics } = makeObservabilityStub();
    const boom = new Error('exec-failed');
    const sb = makeFakeSandbox({
      executeCommand: vi.fn(async () => {
        throw boom;
      }),
    });
    const wrapped = wrapSandbox(sb, META, instance);

    await expect(wrapped.executeCommand!('cmd')).rejects.toBe(boom);
    expect(metrics.some(m => m.name === 'mastra.workspace.sandbox.errors_total')).toBe(true);
  });

  it('instruments processes.spawn and forwards stdout chunks as sandbox_output(spawn)', async () => {
    const { instance, activity } = makeObservabilityStub();

    // Fake process manager: spawn accepts injected onStdout/onStderr and
    // invokes them synchronously with a couple of chunks to simulate streaming.
    const spawnMock = vi.fn(
      async (
        command: string,
        opts: { onStdout?: (data: string) => void; onStderr?: (data: string) => void } | undefined,
      ) => {
        opts?.onStdout?.('hello ');
        opts?.onStdout?.('world\n');
        opts?.onStderr?.('warn!\n');
        return { pid: 'pid-42', command } as any;
      },
    );

    const sb = makeFakeSandbox();
    (sb as any).processes = {
      spawn: spawnMock,
      list: vi.fn(async () => []),
      get: vi.fn(async () => undefined),
    };

    const wrapped = wrapSandbox(sb, META, instance);
    const handle = await wrapped.processes!.spawn('long-cmd');
    expect(handle).toEqual({ pid: 'pid-42', command: 'long-cmd' });

    const outputs = activity.filter(e => e.type === 'sandbox_output');
    expect(outputs).toHaveLength(3);
    for (const evt of outputs) {
      if (evt.type === 'sandbox_output') {
        expect(evt.output.source).toBe('spawn');
      }
    }
    const streams = outputs.map(e => (e.type === 'sandbox_output' ? e.output.stream : ''));
    expect(streams).toEqual(['stdout', 'stdout', 'stderr']);
  });

  it('preserves user-supplied onStdout/onStderr when instrumenting spawn', async () => {
    const { instance } = makeObservabilityStub();
    const userStdout = vi.fn();

    const spawnMock = vi.fn(async (_cmd: string, opts: { onStdout?: (data: string) => void } | undefined) => {
      opts?.onStdout?.('hi');
      return { pid: 'pid-99' } as any;
    });

    const sb = makeFakeSandbox();
    (sb as any).processes = {
      spawn: spawnMock,
      list: vi.fn(async () => []),
      get: vi.fn(async () => undefined),
    };

    const wrapped = wrapSandbox(sb, META, instance);
    await wrapped.processes!.spawn('cmd', { onStdout: userStdout } as any);

    expect(userStdout).toHaveBeenCalledWith('hi');
  });

  it('memoizes the wrapped processes sub-object across reads', () => {
    const { instance } = makeObservabilityStub();
    const sb = makeFakeSandbox();
    (sb as any).processes = {
      spawn: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
    };
    const wrapped = wrapSandbox(sb, META, instance);
    const a = wrapped.processes;
    const b = wrapped.processes;
    expect(a).toBe(b);
  });

  it('leaves non-instrumented properties untouched', () => {
    const { instance } = makeObservabilityStub();
    const sb = makeFakeSandbox();
    const wrapped = wrapSandbox(sb, META, instance);

    expect(wrapped.id).toBe('sb-1');
    expect(wrapped.name).toBe('test-sb');
    expect(wrapped.provider).toBe('local');
  });
});
