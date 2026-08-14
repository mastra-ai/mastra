import type { PulseBusEvent } from '@mastra/core/pulse';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClickHouseHttpPulseExporter } from './exporter';

const CONFIG = { url: 'http://localhost:8123', database: 'pulse_test', username: 'u', password: 'p' };

function pulseEvent(overrides: Record<string, any> = {}): PulseBusEvent {
  return {
    type: 'pulse',
    record: {
      id: 'p1',
      timestamp: new Date('2026-08-14T10:00:00.000Z'),
      seq: 7,
      type: 'state',
      surface: 'agent',
      action: 'run_started',
      text: 'test-agent',
      data: { 'usage.totalTokens': 42 },
      attributes: { input: { q: 'hi' } },
      metadata: { runId: 'run-1' },
      traceId: 'trace-1',
      spanId: 'span-1',
      runId: 'run-1',
      threadId: 'thread-1',
      source: 'span',
      ...overrides,
    },
  };
}

function relationshipEvent(): PulseBusEvent {
  return {
    type: 'relationship',
    record: {
      id: 'r1',
      timestamp: new Date('2026-08-14T10:00:01.000Z'),
      seq: 8,
      type: 'origin_of',
      from: { kind: 'pulse', id: 'span-1' },
      to: { kind: 'flow', id: 'trace-1' },
      traceId: 'trace-1',
    },
  };
}

function fetchOk() {
  return vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
}

/** Parse all JSONEachRow bodies from fetch calls into { table: rows[] }. */
function insertedRows(fetchMock: ReturnType<typeof vi.fn>) {
  const out: Record<string, any[]> = { pulses: [], relationships: [] };
  for (const [url, init] of fetchMock.mock.calls) {
    const table = decodeURIComponent(String(url)).includes('INSERT INTO pulse_test.relationships')
      ? 'relationships'
      : 'pulses';
    for (const line of String(init.body).split('\n')) out[table]!.push(JSON.parse(line));
  }
  return out;
}

describe('ClickHouseHttpPulseExporter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('serializes pulse records into JSONEachRow rows with correlation columns', async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new ClickHouseHttpPulseExporter(CONFIG);
    exporter.onPulseEvent(pulseEvent());
    exporter.onPulseEvent(relationshipEvent());
    expect(fetchMock).not.toHaveBeenCalled(); // buffered until flush
    await exporter.shutdown();

    const rows = insertedRows(fetchMock);
    expect(rows.pulses![0]).toMatchObject({
      id: 'p1',
      timestamp: '2026-08-14 10:00:00.000',
      seq: 7,
      type: 'state',
      surface: 'agent',
      action: 'run_started',
      trace_id: 'trace-1',
      span_id: 'span-1',
      run_id: 'run-1',
      thread_id: 'thread-1',
      resource_id: '',
      source: 'span',
    });
    expect(JSON.parse(rows.pulses![0].data)).toEqual({ 'usage.totalTokens': 42 });
    expect(JSON.parse(rows.pulses![0].metadata)).toEqual({ runId: 'run-1' });
    expect(rows.relationships![0]).toMatchObject({
      type: 'origin_of',
      from_kind: 'pulse',
      from_id: 'span-1',
      to_kind: 'flow',
      to_id: 'trace-1',
    });
  });

  it('flushes when the batch size is reached', async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new ClickHouseHttpPulseExporter({ ...CONFIG, batchSize: 2 });
    exporter.onPulseEvent(pulseEvent());
    expect(fetchMock).not.toHaveBeenCalled();
    exporter.onPulseEvent(pulseEvent({ id: 'p2' }));
    await exporter.flush();
    expect(fetchMock).toHaveBeenCalled();
    expect(insertedRows(fetchMock).pulses).toHaveLength(2);
    await exporter.shutdown();
  });

  it('records bus drop events as system pulses', async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new ClickHouseHttpPulseExporter(CONFIG);
    exporter.onDroppedEvent({
      type: 'drop',
      signal: 'pulse',
      reason: 'retry-exhausted',
      count: 3,
      timestamp: new Date(),
      exporterName: 'pulse-storage',
    });
    await exporter.shutdown();

    const { pulses } = insertedRows(fetchMock);
    expect(pulses![0]).toMatchObject({
      type: 'system',
      surface: 'execution',
      action: 'events_dropped',
      source: 'drop',
    });
    expect(JSON.parse(pulses![0].data)).toEqual({ count: 3 });
  });

  it('retries a failed insert once, then drops and counts', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' })
      .mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new ClickHouseHttpPulseExporter(CONFIG);
    exporter.onPulseEvent(pulseEvent());
    await exporter.flush();
    expect(fetchMock).toHaveBeenCalledTimes(2); // failed once, retried, succeeded
    expect(exporter.dropped).toBe(0);
    await exporter.shutdown();
  });

  it('never throws when ClickHouse is unreachable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new ClickHouseHttpPulseExporter(CONFIG);
    exporter.onPulseEvent(pulseEvent());
    await expect(exporter.shutdown()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalled();
    expect(exporter.dropped).toBe(1);
  });
});
