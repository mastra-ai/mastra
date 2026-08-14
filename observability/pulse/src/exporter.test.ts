import { TracingEventType } from '@mastra/core/observability';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PulseExporter } from './exporter';
import { attachPulseSession } from './session';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

const CONFIG = { url: 'http://localhost:8123', database: 'pulse_test', username: 'u', password: 'p' };

function makeSpan(overrides: Record<string, any> = {}) {
  return {
    id: 'span-1',
    name: 'test-agent',
    type: 'agent_run',
    traceId: 'trace-1',
    startTime: new Date('2026-08-14T10:00:00.000Z'),
    endTime: new Date('2026-08-14T10:00:01.500Z'),
    isRootSpan: false,
    isEvent: false,
    metadata: { runId: 'run-1', threadId: 'thread-1', resourceId: 'res-1' },
    attributes: {},
    ...overrides,
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
    for (const line of String(init.body).split('\n')) out[table].push(JSON.parse(line));
  }
  return out;
}

describe('PulseExporter (config surface)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('is disabled without url/database and performs zero fetches', async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new PulseExporter({ logger } as any);
    expect(exporter.isDisabled).toBe(true);

    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: makeSpan() as any });
    await exporter.flush();
    await exporter.shutdown();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('flushes when the batch size is reached', async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new PulseExporter({ ...CONFIG, batchSize: 3, logger } as any);
    const span = makeSpan({ isRootSpan: true });
    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: span as any });
    expect(fetchMock).not.toHaveBeenCalled();
    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span as any });
    await exporter.flush();
    expect(fetchMock).toHaveBeenCalled();

    const rows = insertedRows(fetchMock);
    expect(rows.pulses).toHaveLength(2);
    expect(rows.relationships[0]).toMatchObject({
      type: 'origin_of',
      from_kind: 'pulse',
      to_kind: 'flow',
      to_id: 'trace-1',
    });
    await exporter.shutdown();
  });

  it('drains on shutdown and translates agent spans with identity + usage', async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new PulseExporter({ ...CONFIG, logger } as any);
    const span = makeSpan({ input: { q: 'hi' }, output: { a: 'yo' }, attributes: { usage: { totalTokens: 42 } } });
    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: span as any });
    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span as any });
    expect(fetchMock).not.toHaveBeenCalled();
    await exporter.shutdown();

    const { pulses } = insertedRows(fetchMock);
    expect(pulses[0]).toMatchObject({
      type: 'state',
      surface: 'agent',
      action: 'run_started',
      run_id: 'run-1',
      thread_id: 'thread-1',
    });
    expect(pulses[1]).toMatchObject({ type: 'output', action: 'run_completed' });
    expect(JSON.parse(pulses[1].data)).toEqual({ 'usage.totalTokens': 42 });
  });

  it('emits resume_of for resumed roots', async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new PulseExporter({ ...CONFIG, logger } as any);
    const span = makeSpan({
      id: 'resumed-root',
      isRootSpan: true,
      parentSpanId: 'suspended-span',
      metadata: { runId: 'run-2', resumed: true, resumedFromSpanId: 'suspended-span' },
    });
    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span as any });
    await exporter.shutdown();

    const rels = insertedRows(fetchMock).relationships;
    expect(rels).toContainEqual(
      expect.objectContaining({ type: 'resume_of', from_id: 'resumed-root', to_id: 'suspended-span' }),
    );
  });

  it('captures cost from metric events (spans never carry it)', async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new PulseExporter({ ...CONFIG, logger } as any);
    exporter.onMetricEvent({
      type: 'metric',
      metric: {
        metricId: 'm1',
        timestamp: new Date(),
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'mastra_output_tokens',
        value: 7,
        labels: { model: 'gpt-4o-mini' },
        costContext: { estimatedCost: 0.00042 },
      },
    } as any);
    await exporter.shutdown();

    const { pulses } = insertedRows(fetchMock);
    expect(pulses[0]).toMatchObject({ surface: 'model', action: 'mastra_output_tokens', source: 'metric' });
    expect(JSON.parse(pulses[0].data)).toEqual({ value: 7, estimated_cost_usd: 0.00042 });
  });

  it('maps score events to eval pulses with scored_target edges', async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new PulseExporter({ ...CONFIG, logger } as any);
    exporter.onScoreEvent({
      type: 'score',
      score: { scoreId: 's1', timestamp: new Date(), traceId: 'trace-1', spanId: 'span-9', scorerId: 'sc', score: 0.9 },
    } as any);
    await exporter.shutdown();

    const rows = insertedRows(fetchMock);
    expect(rows.pulses[0]).toMatchObject({ surface: 'eval', action: 'score_recorded', type: 'output' });
    expect(rows.relationships[0]).toMatchObject({ type: 'scored_target', to_kind: 'pulse', to_id: 'span-9' });
  });

  it('counts skipped SPAN_UPDATED events without writing rows', async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new PulseExporter({ ...CONFIG, logger } as any);
    const span = makeSpan();
    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: span as any });
    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_UPDATED, exportedSpan: span as any });
    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span as any });
    await exporter.shutdown();

    expect(exporter.skippedUpdateCount).toBe(1);
    expect(insertedRows(fetchMock).pulses).toHaveLength(2);
  });

  it('routes session facts through the exporter writer', async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new PulseExporter({ ...CONFIG, logger } as any);
    let listener: (e: any) => void = () => {};
    const session = {
      subscribe(l: (e: any) => void) {
        listener = l;
        return () => {};
      },
    };
    attachPulseSession(session, exporter, { threadId: 't-1', resourceId: 'r-1' });
    listener({ type: 'tool_approval_required', toolCallId: 'c1', toolName: 'issue_refund' });
    listener({ type: 'agent_end', reason: 'aborted' });
    await exporter.shutdown();

    const { pulses } = insertedRows(fetchMock);
    expect(pulses).toContainEqual(
      expect.objectContaining({ surface: 'tool_approval', action: 'required', source: 'session', thread_id: 't-1' }),
    );
    expect(pulses).toContainEqual(expect.objectContaining({ surface: 'run_control', action: 'abort_completed' }));
  });

  it('writes through a PulseStorage domain when configured (no HTTP)', async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal('fetch', fetchMock);
    const storage = {
      batchCreatePulses: vi.fn().mockResolvedValue(undefined),
      batchCreateRelationships: vi.fn().mockResolvedValue(undefined),
    };

    const exporter = new PulseExporter({ storage, logger } as any);
    expect(exporter.isDisabled).toBe(false);
    const span = makeSpan({ isRootSpan: true, attributes: { usage: { totalTokens: 5 } } });
    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span as any });
    await exporter.shutdown();

    expect(fetchMock).not.toHaveBeenCalled();
    const records = storage.batchCreatePulses.mock.calls[0]![0];
    expect(records[0]).toMatchObject({
      traceId: 'trace-1',
      spanId: 'span-1',
      runId: 'run-1',
      source: 'span',
      data: { 'usage.totalTokens': 5 },
    });
    expect(records[0].timestamp).toBeInstanceOf(Date);
    const rels = storage.batchCreateRelationships.mock.calls[0]![0];
    expect(rels[0]).toMatchObject({ type: 'origin_of', from: { kind: 'pulse', id: 'span-1' }, to: { kind: 'flow' } });
  });

  it('never throws when ClickHouse is unreachable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    const exporter = new PulseExporter({ ...CONFIG, logger } as any);
    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: makeSpan() as any });
    await expect(exporter.shutdown()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalled();
  });
});
