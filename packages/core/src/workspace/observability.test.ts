import { describe, expect, it, vi } from 'vitest';

import type {
  AnySpan,
  LoggerContext,
  MetricsContext,
  ObservabilityInstance,
  WorkspaceActivityEvent,
} from '../observability';
import { executeWithContext } from '../observability/context-storage';
import type { WorkspaceFilesystem } from './filesystem/filesystem';
import type { WorkspaceInstrumentationMeta } from './observability';
import { SANDBOX_OUTPUT_CHUNK_LIMIT, truncateChunk, wrapFilesystem, wrapSandbox } from './observability';
import type { WorkspaceSandbox } from './sandbox/sandbox';

/**
 * Minimal `ObservabilityInstance` stub. Records every call so tests can assert
 * on metrics, logs, and workspace_activity events without pulling in the full
 * `@mastra/observability` runtime.
 */
interface RecordedSpan {
  kind: 'root' | 'child';
  name: string;
  traceId: string;
  spanId: string;
  attributes?: Record<string, unknown>;
  input?: unknown;
  output?: unknown;
  ended: boolean;
  errored: boolean;
}

let spanCounter = 0;

/** Build a fake span with just the surface the wrapper touches. */
function makeFakeSpan(kind: 'root' | 'child', name: string, records: RecordedSpan[], parentTraceId?: string): AnySpan {
  spanCounter += 1;
  const traceId = parentTraceId ?? `trace-${spanCounter}`;
  const spanId = `span-${spanCounter}`;
  const record: RecordedSpan = { kind, name, traceId, spanId, ended: false, errored: false };
  records.push(record);

  const span: any = {
    id: spanId,
    traceId,
    name,
    isValid: true,
    end: (opts?: any) => {
      record.ended = true;
      if (opts?.output !== undefined) record.output = opts.output;
      if (opts?.attributes) record.attributes = { ...(record.attributes ?? {}), ...opts.attributes };
    },
    error: (opts?: any) => {
      record.errored = true;
      if (opts?.attributes) record.attributes = { ...(record.attributes ?? {}), ...opts.attributes };
    },
    createChildSpan: (childOpts: any) => {
      const child = makeFakeSpan('child', childOpts.name, records, traceId);
      if (childOpts.attributes) {
        // Attach attributes to the RecordedSpan we just pushed.
        records[records.length - 1].attributes = childOpts.attributes;
      }
      if (childOpts.input !== undefined) {
        records[records.length - 1].input = childOpts.input;
      }
      return child;
    },
    getCorrelationContext: () => undefined,
  };
  if (kind === 'root' && arguments) {
    // no-op; kept for symmetry
  }
  return span as AnySpan;
}

function makeObservabilityStub() {
  const metrics: Array<{ name: string; value: number; labels?: Record<string, unknown> }> = [];
  const logs: Array<{ level: 'info' | 'error'; message: string; data?: Record<string, unknown> }> = [];
  const activity: WorkspaceActivityEvent[] = [];
  const spans: RecordedSpan[] = [];

  const buildLogger = (span?: AnySpan): LoggerContext =>
    ({
      debug: vi.fn(),
      info: vi.fn((message: string, data?: Record<string, unknown>) => {
        logs.push({ level: 'info', message, data: { ...data, traceId: span?.traceId, spanId: span?.id } });
      }),
      warn: vi.fn(),
      error: vi.fn((message: string, data?: Record<string, unknown>) => {
        logs.push({ level: 'error', message, data: { ...data, traceId: span?.traceId, spanId: span?.id } });
      }),
      fatal: vi.fn(),
    }) as unknown as LoggerContext;

  const buildMetricsContext = (span?: AnySpan): MetricsContext =>
    ({
      emit(name: string, value: number, labels?: Record<string, unknown>) {
        metrics.push({
          name,
          value,
          labels: { ...labels, traceId: span?.traceId, spanId: span?.id },
        });
      },
    }) as unknown as MetricsContext;

  const instance: ObservabilityInstance = {
    getConfig: () => ({}) as any,
    getExporters: () => [],
    getSpanOutputProcessors: () => [],
    getLogger: () => ({}) as any,
    getBridge: () => undefined,
    startSpan: ((opts: any) => {
      const span = makeFakeSpan('root', opts.name, spans);
      // Capture the input/attributes provided at creation time.
      const rec = spans[spans.length - 1];
      if (opts.input !== undefined) rec.input = opts.input;
      if (opts.attributes) rec.attributes = { ...(rec.attributes ?? {}), ...opts.attributes };
      return span;
    }) as any,
    rebuildSpan: () => ({}) as any,
    flush: async () => {},
    shutdown: async () => {},
    __setLogger: () => {},
    getLoggerContext: (span?: AnySpan) => buildLogger(span),
    getMetricsContext: (span?: AnySpan) => buildMetricsContext(span),
    emitWorkspaceActivityEvent: (event: WorkspaceActivityEvent) => {
      activity.push(event);
    },
  };

  return { instance, metrics, logs, activity, spans };
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

  it('enforces limit as UTF-8 bytes, not UTF-16 code units, for multibyte input', () => {
    // '💻' encodes as 4 bytes (surrogate pair in UTF-16 => 2 code units, but 4 bytes in UTF-8).
    // 5 emoji => 20 bytes. Limit of 10 bytes should keep exactly 2 emoji.
    const source = '💻'.repeat(5);
    const result = truncateChunk(source, 10);
    expect(result.truncated).toBe(true);
    expect(result.chunk).toBe('💻💻');
    expect(Buffer.byteLength(result.chunk, 'utf8')).toBeLessThanOrEqual(10);
  });

  it('never emits partial UTF-8 sequences (whole code points only)', () => {
    // 3 emoji => 12 bytes. Limit of 5 bytes cannot fit even one whole emoji beyond
    // the first; it should keep one full emoji and stop rather than slice a surrogate.
    const source = '💻💻💻';
    const result = truncateChunk(source, 5);
    expect(result.truncated).toBe(true);
    // First code point is 4 bytes; adding a second would exceed 5 bytes.
    expect(result.chunk).toBe('💻');
    expect(Buffer.byteLength(result.chunk, 'utf8')).toBeLessThanOrEqual(5);
  });
});

describe('sandbox command redaction in telemetry', () => {
  it('records only argv0 in span input and structured logs (not the full command)', async () => {
    const { instance, logs, spans } = makeObservabilityStub();
    const sb = makeFakeSandbox({
      // Command carries a secret that MUST NOT surface in telemetry.
      executeCommand: vi.fn(async (_command: string) => ({
        success: true,
        exitCode: 0,
        stdout: 'ok\n',
        stderr: '',
        executionTimeMs: 1,
      })),
    });
    const wrapped = wrapSandbox(sb, META, instance);

    const rawCommand = '/usr/bin/curl -H "Authorization: Bearer supersecret" https://example.com';
    await wrapped.executeCommand!(rawCommand);

    // The underlying provider must still see the raw command.
    expect(sb.executeCommand).toHaveBeenCalledWith(rawCommand);

    // No emitted log carries the full command or the secret.
    for (const l of logs) {
      const serialized = JSON.stringify(l);
      expect(serialized).not.toContain('supersecret');
      expect(serialized).not.toContain('Bearer');
      expect(serialized).not.toContain('example.com');
    }

    // The info log DOES carry the sanitized program name.
    const infoLog = logs.find(l => l.message === 'workspace.sandbox.executeCommand');
    expect(infoLog?.data?.commandProgram).toBe('curl');

    // The span input DOES NOT carry the raw command.
    expect(spans).toHaveLength(1);
    const span = spans[0];
    const serializedSpan = JSON.stringify(span);
    expect(serializedSpan).not.toContain('supersecret');
    expect(serializedSpan).not.toContain('Bearer');
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

  it('opens a ROOT workspace:filesystem:<op> span when no ambient parent exists', async () => {
    const { instance, metrics, logs, activity, spans } = makeObservabilityStub();
    const fs = makeFakeFilesystem();
    const wrapped = wrapFilesystem(fs, META, instance);

    await wrapped.writeFile('/foo.txt', 'hi');

    // Exactly one span, kind=root, name follows the workspace:filesystem:<op> pattern.
    expect(spans).toHaveLength(1);
    expect(spans[0].kind).toBe('root');
    expect(spans[0].name).toBe('workspace:filesystem:writeFile');
    expect(spans[0].ended).toBe(true);
    expect(spans[0].errored).toBe(false);

    // Logs, metrics, and the filesystem_change event all share the SAME
    // traceId/spanId as the operation span.
    const { traceId, spanId } = spans[0];
    const durationMetric = metrics.find(m => m.name === 'mastra.workspace.filesystem.duration_ms');
    expect(durationMetric?.labels).toMatchObject({ traceId, spanId });

    const infoLog = logs.find(l => l.message === 'workspace.filesystem.writeFile');
    expect(infoLog?.data).toMatchObject({ traceId, spanId });

    const change = activity[0];
    expect(change?.type).toBe('filesystem_change');
    if (change?.type === 'filesystem_change') {
      expect(change.change.traceId).toBe(traceId);
      expect(change.change.spanId).toBe(spanId);
    }
  });

  it('nests a CHILD span under the ambient parent when one exists', async () => {
    const { instance, metrics, activity, spans } = makeObservabilityStub();
    const fs = makeFakeFilesystem();
    const wrapped = wrapFilesystem(fs, META, instance);

    // Simulate an outer AGENT_RUN span in the ambient context. Share the same
    // records array so parent + child are captured in one place.
    const parent = makeFakeSpan('root', 'agent-run', spans);
    // Reset counter so assertions can compare simple values.
    expect(spans).toHaveLength(1);

    await executeWithContext({
      span: parent,
      fn: async () => {
        await wrapped.writeFile('/foo.txt', 'hi');
      },
    });

    // Two spans: the pre-existing parent and one child created by the wrapper.
    expect(spans).toHaveLength(2);
    const child = spans[1];
    expect(child.kind).toBe('child');
    expect(child.name).toBe('workspace:filesystem:writeFile');
    expect(child.traceId).toBe(parent.traceId);
    expect(child.ended).toBe(true);

    // Instance.startSpan MUST NOT have been called — we nest, not root.
    // (No easy assert; verify by counting root spans instead.)
    const roots = spans.filter(s => s.kind === 'root');
    expect(roots).toHaveLength(1); // just the parent

    const durationMetric = metrics.find(m => m.name === 'mastra.workspace.filesystem.duration_ms');
    expect(durationMetric?.labels).toMatchObject({ traceId: parent.traceId, spanId: child.spanId });

    const change = activity[0];
    if (change?.type === 'filesystem_change') {
      expect(change.change.traceId).toBe(parent.traceId);
      expect(change.change.spanId).toBe(child.spanId);
    }
  });

  it('marks the operation span errored when the underlying call throws', async () => {
    const { instance, spans } = makeObservabilityStub();
    const boom = new Error('boom');
    const fs = makeFakeFilesystem({
      writeFile: vi.fn(async () => {
        throw boom;
      }),
    });
    const wrapped = wrapFilesystem(fs, META, instance);

    await expect(wrapped.writeFile('/foo.txt', 'x')).rejects.toBe(boom);

    expect(spans).toHaveLength(1);
    expect(spans[0].errored).toBe(true);
    expect(spans[0].attributes).toMatchObject({ success: false });
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
  it('opens a ROOT workspace:sandbox:executeCommand span when no ambient parent exists', async () => {
    const { instance, activity, spans } = makeObservabilityStub();
    const sb = makeFakeSandbox();
    const wrapped = wrapSandbox(sb, META, instance);

    await wrapped.executeCommand!('echo hello');

    expect(spans).toHaveLength(1);
    expect(spans[0].kind).toBe('root');
    expect(spans[0].name).toBe('workspace:sandbox:executeCommand');
    expect(spans[0].ended).toBe(true);

    const output = activity.find(e => e.type === 'sandbox_output');
    if (output?.type === 'sandbox_output') {
      expect(output.output.traceId).toBe(spans[0].traceId);
      expect(output.output.spanId).toBe(spans[0].spanId);
    }
  });

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
