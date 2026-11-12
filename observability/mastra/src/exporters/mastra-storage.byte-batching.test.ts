import { Mastra } from '@mastra/core';
import { ConsoleLogger } from '@mastra/core/logger';
import type { LogEvent } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Observability } from '../default';
import { EventBuffer } from './event-buffer';
import { MastraStorageExporter } from './mastra-storage';

const exporters: MastraStorageExporter[] = [];
afterEach(async () => {
  for (const exporter of exporters.splice(0)) await exporter.shutdown();
});

async function setup(
  strategy: 'insert-only' | 'batch-with-updates' | 'realtime' = 'insert-only',
  limits = {},
  logger?: ConsoleLogger,
) {
  const storage = new InMemoryStore();
  const config = {
    strategy,
    maxBatchWaitMs: 60_000,
    byteBatching: { maxBatchBytes: 1024, ...limits },
  };
  const exporter = new MastraStorageExporter(config);
  exporters.push(exporter);
  const observability = new Observability({
    configs: { default: { serviceName: 'byte-budget-test', exporters: [exporter] } },
  });
  const mastra = new Mastra({ storage, observability, logger: logger ?? false });
  await exporter.init({ mastra });
  return {
    exporter,
    mastra,
    storage: (await storage.getStore('observability'))!,
    tracing: observability.getDefaultInstance()!,
  };
}

function log(id: number, message = 'x'.repeat(600)): LogEvent {
  return { type: 'log', log: { logId: `log-${id}`, timestamp: new Date(), level: 'info', message } };
}

describe('Storage byte batching', () => {
  it('persists records larger than the byte threshold intact', async () => {
    const { exporter, storage } = await setup();
    await exporter.onLogEvent(log(1, 'x'.repeat(2000)));
    await exporter.onLogEvent(log(2));
    await exporter.flush();
    const result = await storage.listLogs({ pagination: { page: 0, perPage: 100 } });
    expect(result.logs.map(row => row.logId).sort()).toEqual(['log-1', 'log-2']);
    expect(result.logs.find(row => row.logId === 'log-1')?.message).toBe('x'.repeat(2000));
  });

  it('retains every event during a burst', async () => {
    const { exporter, storage } = await setup();
    await Promise.all(Array.from({ length: 50 }, (_, i) => exporter.onLogEvent(log(i))));
    await exporter.flush();
    const result = await storage.listLogs({ pagination: { page: 0, perPage: 100 } });
    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.logs.length).toBe(50);
  });

  it('snapshots admitted payloads and releases accounting after persistence', async () => {
    const { exporter, storage } = await setup();
    const event = log(1, 'original');
    await exporter.onLogEvent(event);
    const reserved = exporter.getByteBatchingStats()!.pendingBytes;
    event.log.message = 'changed'.repeat(1000);
    expect(exporter.getByteBatchingStats()!.pendingBytes).toBe(reserved);
    await Promise.all([exporter.flush(), exporter.flush()]);
    const result = await storage.listLogs({ pagination: { page: 0, perPage: 100 } });
    expect(result.logs[0]?.message).toBe('original');
    expect(exporter.getByteBatchingStats()).toMatchObject({ pendingBytes: 0, pendingRecords: 0, activeWrites: 0 });
  });

  it('reports serialization errors without silently dropping records', async () => {
    const { exporter, storage } = await setup();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(exporter.onLogEvent({ ...log(1), log: { ...log(1).log, data: circular } })).rejects.toThrow();
    await exporter.onLogEvent(log(2));
    await exporter.flush();
    const result = await storage.listLogs({ pagination: { page: 0, perPage: 100 } });
    expect(result.logs.map(row => row.logId)).toEqual(['log-2']);
  });

  it.each([{ maxBatchBytes: 0 }, { maxBatchBytes: NaN }, { maxConcurrentWrites: 1.5 }])(
    'rejects invalid byte configuration %j',
    byteBatching => {
      expect(() => new MastraStorageExporter({ byteBatching })).toThrow();
    },
  );

  it('ignores byte batching for realtime and persists before the handler resolves', async () => {
    const { exporter, storage } = await setup('realtime');
    await exporter.onLogEvent(log(1));
    expect(exporter.getByteBatchingStats()).toBeUndefined();
    expect((await storage.listLogs({ pagination: { page: 0, perPage: 100 } })).logs.map(row => row.logId)).toEqual([
      'log-1',
    ]);
  });

  it('warns once at initialization when realtime ignores byte batching', async () => {
    const logger = new ConsoleLogger({ name: 'realtime-warning-test' });
    const warnings = vi.spyOn(logger, 'warn');
    try {
      const { exporter, mastra } = await setup('realtime', {}, logger);
      await exporter.init({ mastra });
      await exporter.onLogEvent(log(1));
      await exporter.onLogEvent(log(2));
      await exporter.flush();
      expect(warnings.mock.calls.filter(([message]) => message.includes('byteBatching is ignored'))).toHaveLength(1);
    } finally {
      warnings.mockRestore();
    }
  });

  it('rejects a stalled drain without losing queued data or scheduling a retry loop', async () => {
    const { exporter, storage } = await setup();
    await exporter.onLogEvent(log(1));
    // Fault injection for the defensive path: a future bookkeeping bug could
    // leave queued data with no eligible batch. Keep a pre-fix run from hanging.
    let attempts = 0;
    const take = vi.spyOn(EventBuffer.prototype, 'takeByteBatch').mockImplementation(() => {
      if (++attempts > 3) throw new Error('test stopped an unbounded drain');
      return { creates: [], updates: [] };
    });
    try {
      await expect(exporter.flush()).rejects.toThrow('no progress');
      expect(exporter.getByteBatchingStats()?.pendingRecords).toBe(1);
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(attempts).toBe(1);
    } finally {
      take.mockRestore();
    }
    await exporter.flush();
    expect((await storage.listLogs({ pagination: { page: 0, perPage: 100 } })).logs.map(row => row.logId)).toEqual([
      'log-1',
    ]);
  });

  it('logs a stalled shutdown and retains the queue without rejecting shutdown', async () => {
    const logger = new ConsoleLogger({ name: 'shutdown-failure-test' });
    const errors = vi.spyOn(logger, 'error');
    const info = vi.spyOn(logger, 'info');
    const { exporter, storage } = await setup('insert-only', {}, logger);
    await exporter.onLogEvent(log(1));
    const take = vi.spyOn(EventBuffer.prototype, 'takeByteBatch').mockReturnValue({ creates: [], updates: [] });
    try {
      await expect(exporter.shutdown()).resolves.toBeUndefined();
      expect(exporter.getByteBatchingStats()?.pendingRecords).toBe(1);
      expect(
        errors.mock.calls.some(([message]) => message === 'Failed to flush remaining events during shutdown'),
      ).toBe(true);
      expect(info.mock.calls.some(([message]) => message === 'MastraStorageExporter shutdown complete')).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(take).toHaveBeenCalledTimes(1);
    } finally {
      take.mockRestore();
      errors.mockRestore();
      info.mockRestore();
    }
    await exporter.flush();
    expect((await storage.listLogs({ pagination: { page: 0, perPage: 100 } })).logs.map(row => row.logId)).toEqual([
      'log-1',
    ]);
  });

  it.each(['batch-with-updates', 'realtime'] as const)('preserves create, update and end with %s', async strategy => {
    const { exporter, storage, tracing } = await setup(strategy, { maxBatchBytes: 4000 });
    const span = tracing.startSpan({ type: SpanType.GENERIC, name: 'ordered span', input: { question: 'hello' } });
    span.update({ metadata: { state: 'working' } });
    span.end({ output: { answer: 'done' } });
    await tracing.flush();
    const stored = await storage.getSpan({ traceId: span.traceId, spanId: span.id });
    expect(stored?.span.output).toEqual({ answer: 'done' });
    expect(stored?.span.metadata?.state).toBe('working');
    expect(stored?.span.endedAt).toBeInstanceOf(Date);
    await exporter.shutdown();
  });
});
