import { describe, it, expect, vi } from 'vitest';
import type { LoggerAdapterContext } from './adapter';
import { isAdaptableLogger } from './adapter';
import { LogLevel } from './constants';
import { ConsoleLogger } from './default-logger';
import type { IMastraLogger } from './logger';
import { MultiLogger } from './multi-logger';

const TRACE_FIELDS = { trace_id: '0af7651916cd43dd8448eb211c80319c', span_id: 'b7ad6b7169203331' };

function makeSink() {
  const calls: Array<{ level: string; message: string; data?: Record<string, unknown> }> = [];
  const make = (level: string) => (message: string, data?: Record<string, unknown>) =>
    calls.push({ level, message, data });
  return { calls, debug: make('debug'), info: make('info'), warn: make('warn'), error: make('error') };
}

function makeCtx(): { ctx: LoggerAdapterContext; sink: ReturnType<typeof makeSink> } {
  const sink = makeSink();
  return {
    sink,
    ctx: {
      resolveTraceFields: () => TRACE_FIELDS,
      getLogSink: () => sink,
      options: { correlation: true, export: true },
    },
  };
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

describe('MultiLogger observability adapter', () => {
  it('is adaptable', () => {
    expect(isAdaptableLogger(new MultiLogger([]))).toBe(true);
  });

  it('fans correlation out to adaptable children with export disabled', () => {
    const child = new ConsoleLogger({ level: LogLevel.INFO });
    const attach = vi.spyOn(child, '__attachObservability');
    const multi = new MultiLogger([child, makePlainLogger()]);
    const { ctx } = makeCtx();

    multi.__attachObservability(ctx);

    expect(attach).toHaveBeenCalledTimes(1);
    const childCtx = attach.mock.calls[0]![0];
    expect(childCtx.options).toEqual({ correlation: true, export: false });
    expect(childCtx.resolveTraceFields()).toEqual(TRACE_FIELDS);
  });

  it('exports each record exactly once at the MultiLogger level', () => {
    const console1 = new ConsoleLogger({ level: LogLevel.INFO });
    const console2 = new ConsoleLogger({ level: LogLevel.INFO });
    const multi = new MultiLogger([console1, console2]);
    const { ctx, sink } = makeCtx();
    multi.__attachObservability(ctx);

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    multi.info('hello', { a: 1 });
    infoSpy.mockRestore();

    expect(sink.calls).toEqual([{ level: 'info', message: 'hello', data: { a: 1 } }]);
  });

  it('exports tracked exceptions once with MastraError fields', () => {
    const child = new ConsoleLogger({ level: LogLevel.INFO });
    const multi = new MultiLogger([child]);
    const { ctx, sink } = makeCtx();
    multi.__attachObservability(ctx);

    const err = Object.assign(new Error('boom'), { id: 'ERR_1', domain: 'AGENT', category: 'USER' });
    multi.trackException(err as any, { runId: 'r1' });

    expect(sink.calls).toEqual([
      {
        level: 'error',
        message: 'boom',
        data: { errorId: 'ERR_1', domain: 'AGENT', category: 'USER', runId: 'r1' },
      },
    ]);
  });

  it('does not export when never attached', () => {
    const plain = makePlainLogger();
    const multi = new MultiLogger([plain]);

    multi.info('unattached');

    expect(plain.info).toHaveBeenCalledWith('unattached');
  });
});
