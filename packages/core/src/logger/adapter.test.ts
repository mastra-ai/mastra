import { describe, it, expect, vi, afterEach } from 'vitest';
import { Mastra } from '../mastra';
import { NoOpObservability } from '../observability';
import { executeWithContext } from '../observability/utils';
import {
  resolveTraceFields,
  isAdaptableLogger,
  buildLogRecordData,
  createExportSuppressedLogger,
  isObservabilityExportSuppressed,
} from './adapter';
import type { LoggerAdapterContext } from './adapter';
import { LogLevel } from './constants';
import { ConsoleLogger } from './default-logger';
import { DualLogger } from './dual-logger';
import type { IMastraLogger } from './logger';

// Production path that registers the AsyncLocalStorage span resolver.
new Mastra({ __ephemeral: true });

const VALID_TRACE_ID = '0af7651916cd43dd8448eb211c80319c';
const VALID_SPAN_ID = 'b7ad6b7169203331';

function makeSpan(overrides: Record<string, unknown> = {}) {
  return { id: VALID_SPAN_ID, traceId: VALID_TRACE_ID, ...overrides } as any;
}

function makePlainLogger(): IMastraLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trackException: vi.fn(),
    getTransports: () => new Map(),
    listLogs: async () => ({ logs: [], total: 0, page: 1, perPage: 100, hasMore: false }),
    listLogsByRunId: async () => ({ logs: [], total: 0, page: 1, perPage: 100, hasMore: false }),
  };
}

describe('resolveTraceFields', () => {
  it('returns snake_case W3C trace fields for the active span', async () => {
    let fields: ReturnType<typeof resolveTraceFields>;
    await executeWithContext({
      span: makeSpan(),
      fn: async () => {
        fields = resolveTraceFields();
      },
    });

    expect(fields).toEqual({ trace_id: VALID_TRACE_ID, span_id: VALID_SPAN_ID });
  });

  it('returns undefined when no span is active', () => {
    expect(resolveTraceFields()).toBeUndefined();
  });

  it('resolves span_id to the nearest exportable ancestor for a non-exportable span', async () => {
    // The active span is internal/excluded, so its own id never reaches an
    // exporter. The stored log record for this same event carries the resolved
    // ancestor id, and the stdout line has to agree with it.
    const ancestorSpanId = 'a1b2c3d4e5f60718';
    let fields: ReturnType<typeof resolveTraceFields>;
    await executeWithContext({
      span: makeSpan({ getExportedSpanId: () => ancestorSpanId }),
      fn: async () => {
        fields = resolveTraceFields();
      },
    });

    expect(fields).toEqual({ trace_id: VALID_TRACE_ID, span_id: ancestorSpanId });
    expect(fields?.span_id).not.toBe(VALID_SPAN_ID);
  });

  it('keeps trace_id and omits span_id when no ancestor of the active span is exportable', async () => {
    let fields: ReturnType<typeof resolveTraceFields>;
    await executeWithContext({
      span: makeSpan({ getExportedSpanId: () => undefined }),
      fn: async () => {
        fields = resolveTraceFields();
      },
    });

    // No span is addressable, but the trace still is — so the line keeps
    // trace_id and drops span_id rather than losing correlation entirely.
    expect(fields).toEqual({ trace_id: VALID_TRACE_ID });
    expect(fields && 'span_id' in fields).toBe(false);
  });

  it('returns undefined when the active span is missing ids', async () => {
    let fields: ReturnType<typeof resolveTraceFields>;
    await executeWithContext({
      span: makeSpan({ traceId: undefined }),
      fn: async () => {
        fields = resolveTraceFields();
      },
    });

    expect(fields).toBeUndefined();
  });
});

describe('isAdaptableLogger', () => {
  it('recognizes ConsoleLogger as adaptable', () => {
    expect(isAdaptableLogger(new ConsoleLogger())).toBe(true);
  });

  it('rejects a plain IMastraLogger', () => {
    expect(isAdaptableLogger(makePlainLogger())).toBe(false);
  });
});

describe('buildLogRecordData', () => {
  it('returns undefined for no args', () => {
    expect(buildLogRecordData([])).toBeUndefined();
  });

  it('extracts the first plain object as data', () => {
    expect(buildLogRecordData([{ userId: '1' }])).toEqual({ userId: '1' });
  });

  it('serializes an Error arg', () => {
    const err = new Error('boom');
    expect(buildLogRecordData([err])).toEqual({
      error: { name: 'Error', message: 'boom', stack: err.stack },
    });
  });

  it('collects remaining primitives under args', () => {
    expect(buildLogRecordData([{ a: 1 }, 'x', 42])).toEqual({ a: 1, args: ['x', 42] });
  });
});

describe('createExportSuppressedLogger', () => {
  it('forwards to the inner logger and sets the suppression flag during the call', () => {
    const inner = makePlainLogger();
    let flagDuringCall: boolean | undefined;
    (inner.info as ReturnType<typeof vi.fn>).mockImplementation(() => {
      flagDuringCall = isObservabilityExportSuppressed();
    });

    const suppressed = createExportSuppressedLogger(inner);
    expect(isObservabilityExportSuppressed()).toBe(false);
    suppressed.info('hello', { a: 1 });

    expect(inner.info).toHaveBeenCalledWith('hello', { a: 1 });
    expect(flagDuringCall).toBe(true);
    expect(isObservabilityExportSuppressed()).toBe(false);
  });

  it('restores the flag even when the inner logger throws', () => {
    const inner = makePlainLogger();
    (inner.error as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('inner boom');
    });

    const suppressed = createExportSuppressedLogger(inner);
    expect(() => suppressed.error('bad')).toThrow('inner boom');
    expect(isObservabilityExportSuppressed()).toBe(false);
  });

  it('preserves child() so __setLogger keeps component prefixing, and children stay suppressed', () => {
    const inner = new ConsoleLogger({ level: LogLevel.INFO });
    const suppressed = createExportSuppressedLogger(inner);

    expect(typeof (suppressed as any).child).toBe('function');
    const child = (suppressed as any).child('OBSERVABILITY') as IMastraLogger;

    let flagDuringCall: boolean | undefined;
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {
      flagDuringCall = isObservabilityExportSuppressed();
    });
    child.info('from obs');

    expect(infoSpy).toHaveBeenCalledWith('[OBSERVABILITY] from obs');
    expect(flagDuringCall).toBe(true);
    expect(isObservabilityExportSuppressed()).toBe(false);
    infoSpy.mockRestore();
  });

  it('does not expose child() when the inner logger lacks it', () => {
    const suppressed = createExportSuppressedLogger(makePlainLogger());
    expect('child' in suppressed).toBe(false);
  });
});

describe('Mastra logger wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches observability to adaptable loggers without wrapping them', () => {
    const logger = new ConsoleLogger();
    const attach = vi.spyOn(logger, '__attachObservability');

    const mastra = new Mastra({ logger, __ephemeral: true });

    expect(attach).toHaveBeenCalledTimes(1);
    expect(mastra.getLogger()).toBe(logger);
  });

  it('falls back to DualLogger for non-adaptable loggers', () => {
    const logger = makePlainLogger();

    const mastra = new Mastra({ logger: logger as any, __ephemeral: true });

    expect(mastra.getLogger()).toBeInstanceOf(DualLogger);
    expect((mastra.getLogger() as unknown as DualLogger).baseLogger).toBe(logger);
    // Constructor wiring + setLogger() both run over the same inner logger;
    // the wrapper is reused and the deprecation notice fires only once.
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });

  it('passes loggerOptions through to the adapter context', () => {
    const logger = new ConsoleLogger();
    let ctx: LoggerAdapterContext | undefined;
    vi.spyOn(logger, '__attachObservability').mockImplementation(c => {
      ctx = c;
    });

    new Mastra({ logger, loggerOptions: { export: false }, __ephemeral: true });

    expect(ctx?.options).toEqual({ correlation: true, export: false });
    // Export disabled → no sink even though correlation stays on.
    expect(ctx?.getLogSink()).toBeUndefined();
  });

  it('getLogSink returns undefined when observability is not configured', () => {
    const logger = new ConsoleLogger();
    let ctx: LoggerAdapterContext | undefined;
    vi.spyOn(logger, '__attachObservability').mockImplementation(c => {
      ctx = c;
    });

    new Mastra({ logger, __ephemeral: true });

    // No real logger context exists → no sink, so adapters skip record
    // derivation entirely instead of dispatching into a no-op.
    expect(ctx?.getLogSink()).toBeUndefined();
  });

  it('getLogSink returns undefined while an export-suppressed log call is in flight (recursion guard)', () => {
    const sink = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    class TestObservability extends NoOpObservability {
      override getDefaultInstance() {
        return { getLoggerContext: () => sink } as any;
      }
    }

    const logger = new ConsoleLogger();
    let ctx: LoggerAdapterContext | undefined;
    vi.spyOn(logger, '__attachObservability').mockImplementation(c => {
      ctx = c;
    });

    new Mastra({ logger, observability: new TestObservability() as any, __ephemeral: true });

    // Observability configured → the real sink is resolved.
    expect(ctx?.getLogSink()).toBe(sink);

    // But while a suppressed log call is in flight, the sink is withheld.
    let sinkDuringSuppressedCall: unknown = sink;
    const inner = makePlainLogger();
    (inner.info as ReturnType<typeof vi.fn>).mockImplementation(() => {
      sinkDuringSuppressedCall = ctx?.getLogSink();
    });
    createExportSuppressedLogger(inner).info('observability internal log');

    expect(sinkDuringSuppressedCall).toBeUndefined();
    expect(ctx?.getLogSink()).toBe(sink);
  });

  it('rewires a foreign DualLogger for the current instance instead of reusing it', () => {
    const inner = makePlainLogger();
    const first = new Mastra({ logger: inner as any, __ephemeral: true });
    const firstWrapper = first.getLogger();
    expect(firstWrapper).toBeInstanceOf(DualLogger);

    // Passing the first instance's wrapper into a second Mastra must not
    // reuse it (its export getter targets the first instance): the base
    // logger is unwrapped and wired for the second instance.
    const second = new Mastra({ logger: firstWrapper as any, __ephemeral: true });
    const secondWrapper = second.getLogger();
    expect(secondWrapper).toBeInstanceOf(DualLogger);
    expect(secondWrapper).not.toBe(firstWrapper);
    expect((secondWrapper as unknown as DualLogger).baseLogger).toBe(inner);

    // Re-invoking setLogger with our own wrapper stays idempotent.
    second.setLogger({ logger: secondWrapper });
    expect(second.getLogger()).toBe(secondWrapper);
  });

  it('warns when the same logger instance is attached to a second Mastra instance', () => {
    const logger = new ConsoleLogger({ level: LogLevel.INFO });
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    new Mastra({ logger, __ephemeral: true });
    expect(warnSpy).not.toHaveBeenCalled();

    new Mastra({ logger, __ephemeral: true });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('already wired to another Mastra instance');
  });

  it('warns when a different family member sharing an attachment key is attached to a second Mastra instance', () => {
    // Models PinoLogger's family-shared ref cell: root and child are distinct
    // instances whose adapter context lives on one shared cell, so attaching
    // the child re-targets the root's export too and must warn.
    const sharedKey = {};
    const makeFamilyLogger = () =>
      Object.assign(makePlainLogger(), {
        __attachObservability: vi.fn(),
        __observabilityAttachmentKey: () => sharedKey,
      });
    const root = makeFamilyLogger();
    const child = makeFamilyLogger();

    new Mastra({ logger: root as any, __ephemeral: true });
    expect(child.warn).not.toHaveBeenCalled();

    new Mastra({ logger: child as any, __ephemeral: true });
    expect(child.warn).toHaveBeenCalledTimes(1);
    expect((child.warn as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain(
      'already wired to another Mastra instance',
    );
  });

  it('getLogSink prefers the span-correlated logger context over the global one', async () => {
    const globalSink = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const spanSink = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    class TestObservability extends NoOpObservability {
      override getDefaultInstance() {
        return { getLoggerContext: () => globalSink } as any;
      }
    }

    const logger = new ConsoleLogger();
    let ctx: LoggerAdapterContext | undefined;
    vi.spyOn(logger, '__attachObservability').mockImplementation(c => {
      ctx = c;
    });
    new Mastra({ logger, observability: new TestObservability() as any, __ephemeral: true });

    expect(ctx?.getLogSink()).toBe(globalSink);

    let sinkInSpan: unknown;
    await executeWithContext({
      span: makeSpan({ observabilityInstance: { getLoggerContext: () => spanSink } }),
      fn: async () => {
        sinkInSpan = ctx?.getLogSink();
      },
    });
    expect(sinkInSpan).toBe(spanSink);
  });

  it('end to end: a Mastra-wired logger emits trace fields on its native record inside a span', async () => {
    const logger = new ConsoleLogger({ level: LogLevel.INFO });
    const mastra = new Mastra({ logger, __ephemeral: true });
    // Restored by the afterEach vi.restoreAllMocks(), even on assertion failure.
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await executeWithContext({
      span: makeSpan(),
      fn: async () => {
        mastra.getLogger().info('inside span');
      },
    });
    mastra.getLogger().info('outside span');

    expect(infoSpy).toHaveBeenCalledWith('inside span', {
      trace_id: VALID_TRACE_ID,
      span_id: VALID_SPAN_ID,
    });
    expect(infoSpy).toHaveBeenCalledWith('outside span');
  });
});
