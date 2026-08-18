import { describe, it, expect, vi } from 'vitest';
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
new Mastra();

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
});

describe('Mastra logger wiring', () => {
  it('attaches observability to adaptable loggers without wrapping them', () => {
    const logger = new ConsoleLogger();
    const attach = vi.spyOn(logger, '__attachObservability');

    const mastra = new Mastra({ logger });

    expect(attach).toHaveBeenCalledTimes(1);
    expect(mastra.getLogger()).toBe(logger);
  });

  it('falls back to DualLogger for non-adaptable loggers', () => {
    const logger = makePlainLogger();

    const mastra = new Mastra({ logger: logger as any });

    expect(mastra.getLogger()).toBeInstanceOf(DualLogger);
    expect((mastra.getLogger() as unknown as DualLogger).baseLogger).toBe(logger);
  });

  it('passes loggerOptions through to the adapter context', () => {
    const logger = new ConsoleLogger();
    let ctx: LoggerAdapterContext | undefined;
    vi.spyOn(logger, '__attachObservability').mockImplementation(c => {
      ctx = c;
    });

    new Mastra({ logger, loggerOptions: { export: false } });

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

    new Mastra({ logger });

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

    new Mastra({ logger, observability: new TestObservability() as any });

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

  it('end to end: a Mastra-wired logger emits trace fields on its native record inside a span', async () => {
    const logger = new ConsoleLogger({ level: LogLevel.INFO });
    const mastra = new Mastra({ logger });
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
    infoSpy.mockRestore();
  });
});
