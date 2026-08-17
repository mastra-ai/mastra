import { InMemoryPulseStorage } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { backfillFromObservability } from './backfill';

function fakeObservability(traces: Array<{ traceId: string; spans: any[] }>) {
  return {
    async listTraces({ pagination }: { pagination: { page: number; perPage: number } }) {
      const start = pagination.page * pagination.perPage;
      return { traces: traces.slice(start, start + pagination.perPage).map(t => ({ traceId: t.traceId })) };
    },
    async getTrace({ traceId }: { traceId: string }) {
      return traces.find(t => t.traceId === traceId) ?? null;
    },
  };
}

const SPANS = [
  {
    id: 'root-1',
    name: 'agent run',
    type: 'agent_run',
    startedAt: '2026-08-14T10:00:00.000Z',
    endedAt: '2026-08-14T10:00:02.000Z',
    isRootSpan: true,
    metadata: { runId: 'run-1', threadId: 'thread-1' },
  },
  {
    id: 'model-1',
    name: 'llm',
    type: 'model_generation',
    startedAt: '2026-08-14T10:00:00.100Z',
    endedAt: '2026-08-14T10:00:01.900Z',
    parentSpanId: 'root-1',
    attributes: { model: 'gpt-5', provider: 'openai', usage: { totalTokens: 10 } },
  },
];

describe('backfillFromObservability', () => {
  it('replays persisted spans through the core bridge into a pulse storage', async () => {
    const storage = new InMemoryPulseStorage();
    const observability = fakeObservability([{ traceId: 'trace-1', spans: SPANS }]);

    const result = await backfillFromObservability({ observability, storage });
    expect(result).toEqual({ traces: 1, spans: 2 });

    const { flows, total } = await storage.listFlows();
    expect(total).toBe(1);
    expect(flows[0]).toMatchObject({ flowId: 'trace-1', status: 'completed' });

    const detail = await storage.getFlow('trace-1');
    expect(detail?.tree.map(n => n.spanId).sort()).toEqual(['model-1', 'root-1']);
    expect(detail?.definitions).toContain('model:openai/gpt-5');
  });

  it('emits onto a caller-provided bus without owning its lifecycle', async () => {
    const { PulseBus } = await import('@mastra/core/pulse');
    const bus = new PulseBus();
    const seen: string[] = [];
    bus.subscribe(event => {
      if (event.type === 'pulse') seen.push(event.record.action);
    });

    const observability = fakeObservability([{ traceId: 'trace-1', spans: SPANS }]);
    const result = await backfillFromObservability({ observability, bus });
    expect(result.spans).toBe(2);
    expect(seen).toContain('run_started');
    expect(seen).toContain('generate_completed');
  });

  it('requires a sink', async () => {
    const observability = fakeObservability([]);
    await expect(backfillFromObservability({ observability })).rejects.toThrow(/bus.*or.*storage|`bus` or `storage`/);
  });

  it('honors maxTraces', async () => {
    const storage = new InMemoryPulseStorage();
    const observability = fakeObservability([
      { traceId: 'trace-1', spans: SPANS },
      { traceId: 'trace-2', spans: SPANS.map(s => ({ ...s, id: `${s.id}-b` })) },
    ]);
    const result = await backfillFromObservability({ observability, storage, maxTraces: 1 });
    expect(result.traces).toBe(1);
  });
});

describe('backfill cost parity (the live fold, replayed)', () => {
  /**
   * Live capture folds token+cost into the model end pulse via metric events
   * emitted before span_ended. Persisted spans carry usage+model but NO cost
   * — backfill must RECOMPUTE it through the same estimator path, or every
   * backfilled flow silently loses its bill (found by smoke S7).
   */
  it('folds tokens AND estimated cost into the backfilled model pulse', async () => {
    const storage = new InMemoryPulseStorage();
    const observability = fakeObservability([
      {
        traceId: 'trace-cost',
        spans: [
          {
            id: 'root-c',
            name: 'agent run',
            type: 'agent_run',
            startedAt: '2026-08-14T10:00:00.000Z',
            endedAt: '2026-08-14T10:00:02.000Z',
            isRootSpan: true,
          },
          {
            id: 'model-c',
            name: 'llm',
            type: 'model_generation',
            startedAt: '2026-08-14T10:00:00.100Z',
            endedAt: '2026-08-14T10:00:01.900Z',
            parentSpanId: 'root-c',
            attributes: {
              model: 'gpt-4o-mini',
              provider: 'openai',
              usage: {
                inputTokens: 1000,
                outputTokens: 500,
                inputDetails: { text: 1000, cacheRead: 0, cacheWrite: 0 },
                outputDetails: { text: 500, reasoning: 0 },
              },
            },
          },
        ],
      },
    ]);

    await backfillFromObservability({ observability, storage });

    const detail = await storage.getFlow('trace-cost');
    expect(detail, 'flow must exist').toBeTruthy();
    expect(detail!.costUsd, 'cost must be recomputed at backfill').toBeGreaterThan(0);

    const timeline = await storage.getFlowTimeline('trace-cost');
    // No metric-lane rows: the fold is the only cost carrier.
    expect(timeline.filter(t => t.source === 'metric')).toHaveLength(0);
  });
});
