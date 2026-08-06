import { describe, expect, it } from 'vitest';
import { ObservabilityStorage } from './base';

describe('ObservabilityStorage base class', () => {
  const storage = new ObservabilityStorage();

  it('does not advertise observability features by default', () => {
    expect(storage.getFeatures()).toBeUndefined();
  });

  const methodCases: Array<{ name: string; callThunk: () => Promise<unknown>; expectedMessage: string }> = [
    // Logs
    {
      name: 'batchCreateLogs',
      callThunk: () => storage.batchCreateLogs({ logs: [] }),
      expectedMessage: 'does not support batch creating logs',
    },
    {
      name: 'listLogs',
      callThunk: () => storage.listLogs({}),
      expectedMessage: 'does not support listing logs',
    },

    // Metrics
    {
      name: 'batchCreateMetrics',
      callThunk: () => storage.batchCreateMetrics({ metrics: [] }),
      expectedMessage: 'does not support batch creating metrics',
    },
    {
      name: 'listMetrics',
      callThunk: () => storage.listMetrics({}),
      expectedMessage: 'does not support listing metrics',
    },
    {
      name: 'getMetricAggregate',
      callThunk: () => storage.getMetricAggregate({ name: 'test', aggregation: 'sum' }),
      expectedMessage: 'does not support metric aggregation',
    },
    {
      name: 'getMetricBreakdown',
      callThunk: () => storage.getMetricBreakdown({ name: 'test', groupBy: ['entityType'], aggregation: 'sum' }),
      expectedMessage: 'does not support metric breakdown',
    },
    {
      name: 'getMetricTimeSeries',
      callThunk: () => storage.getMetricTimeSeries({ name: 'test', interval: '1h', aggregation: 'sum' }),
      expectedMessage: 'does not support metric time series',
    },
    {
      name: 'getMetricPercentiles',
      callThunk: () => storage.getMetricPercentiles({ name: 'test', percentiles: [0.5, 0.95], interval: '1h' }),
      expectedMessage: 'does not support metric percentiles',
    },

    // Discovery
    {
      name: 'getMetricNames',
      callThunk: () => storage.getMetricNames({}),
      expectedMessage: 'does not support metric name discovery',
    },
    {
      name: 'getMetricLabelKeys',
      callThunk: () => storage.getMetricLabelKeys({ metricName: 'test' }),
      expectedMessage: 'does not support metric label key discovery',
    },
    {
      name: 'getMetricLabelValues',
      callThunk: () => storage.getMetricLabelValues({ metricName: 'test', labelKey: 'key' }),
      expectedMessage: 'does not support label value discovery',
    },
    {
      name: 'getEntityTypes',
      callThunk: () => storage.getEntityTypes({}),
      expectedMessage: 'does not support entity type discovery',
    },
    {
      name: 'getEntityNames',
      callThunk: () => storage.getEntityNames({}),
      expectedMessage: 'does not support entity name discovery',
    },
    {
      name: 'getServiceNames',
      callThunk: () => storage.getServiceNames({}),
      expectedMessage: 'does not support service name discovery',
    },
    {
      name: 'getEnvironments',
      callThunk: () => storage.getEnvironments({}),
      expectedMessage: 'does not support environment discovery',
    },
    {
      name: 'getTags',
      callThunk: () => storage.getTags({}),
      expectedMessage: 'does not support tag discovery',
    },

    // Traces -- {get,Trace}Light and getStructure each throw a distinct
    // not-implemented error on a bare base class (overriding either is
    // covered separately by the bidirectional-forwarding describe block).
    {
      name: 'getTraceLight',
      callThunk: () => storage.getTraceLight({ traceId: 'test' }),
      expectedMessage: 'does not support getting lightweight traces',
    },
    {
      name: 'getStructure',
      callThunk: () => storage.getStructure({ traceId: 'test' }),
      expectedMessage: 'does not support getting trace structure',
    },
    {
      name: 'listBranches',
      callThunk: () => storage.listBranches({}),
      expectedMessage: 'does not support listing trace branches',
    },
    {
      name: 'getSpans',
      callThunk: () => storage.getSpans({ traceId: 'test', spanIds: ['s1'] }),
      expectedMessage: 'does not support batch-fetching spans',
    },

    // Scores
    {
      name: 'createScore',
      callThunk: () =>
        storage.createScore({
          score: {
            scoreId: 's1',
            timestamp: new Date(),
            traceId: 't1',
            scorerId: 'test',
            score: 0.5,
          },
        }),
      expectedMessage: 'does not support creating scores',
    },
    {
      name: 'listScores',
      callThunk: () => storage.listScores({}),
      expectedMessage: 'does not support listing scores',
    },
    {
      name: 'getScoreById',
      callThunk: () => storage.getScoreById('s1'),
      expectedMessage: 'does not support getting scores by ID',
    },
    {
      name: 'getScoreAggregate',
      callThunk: () => storage.getScoreAggregate({ scorerId: 'test', aggregation: 'sum' }),
      expectedMessage: 'does not support score aggregation',
    },
    {
      name: 'getScoreBreakdown',
      callThunk: () => storage.getScoreBreakdown({ scorerId: 'test', groupBy: ['entityType'], aggregation: 'sum' }),
      expectedMessage: 'does not support score breakdown',
    },
    {
      name: 'getScoreTimeSeries',
      callThunk: () => storage.getScoreTimeSeries({ scorerId: 'test', interval: '1h', aggregation: 'sum' }),
      expectedMessage: 'does not support score time series',
    },
    {
      name: 'getScorePercentiles',
      callThunk: () => storage.getScorePercentiles({ scorerId: 'test', percentiles: [0.5, 0.95], interval: '1h' }),
      expectedMessage: 'does not support score percentiles',
    },

    // Feedback
    {
      name: 'createFeedback',
      callThunk: () =>
        storage.createFeedback({
          feedback: {
            feedbackId: 'f1',
            timestamp: new Date(),
            traceId: 't1',
            feedbackSource: 'user',
            feedbackType: 'thumbs',
            value: 1,
          },
        }),
      expectedMessage: 'does not support creating feedback',
    },
    {
      name: 'listFeedback',
      callThunk: () => storage.listFeedback({}),
      expectedMessage: 'does not support listing feedback',
    },
    {
      name: 'getFeedbackAggregate',
      callThunk: () => storage.getFeedbackAggregate({ feedbackType: 'rating', aggregation: 'avg' }),
      expectedMessage: 'does not support feedback aggregation',
    },
    {
      name: 'getFeedbackBreakdown',
      callThunk: () =>
        storage.getFeedbackBreakdown({ feedbackType: 'rating', groupBy: ['entityType'], aggregation: 'avg' }),
      expectedMessage: 'does not support feedback breakdown',
    },
    {
      name: 'getFeedbackTimeSeries',
      callThunk: () => storage.getFeedbackTimeSeries({ feedbackType: 'rating', interval: '1h', aggregation: 'avg' }),
      expectedMessage: 'does not support feedback time series',
    },
    {
      name: 'getFeedbackPercentiles',
      callThunk: () =>
        storage.getFeedbackPercentiles({ feedbackType: 'rating', percentiles: [0.5, 0.95], interval: '1h' }),
      expectedMessage: 'does not support feedback percentiles',
    },
  ];

  it.each(methodCases)('$name throws not-implemented', async ({ callThunk, expectedMessage }) => {
    await expect(callThunk()).rejects.toThrow(expectedMessage);
  });

  describe('getStructure / getTraceLight bidirectional forwarding', () => {
    const fakeResponse = {
      traceId: 't1',
      spans: [
        {
          traceId: 't1',
          spanId: 's1',
          parentSpanId: null,
          name: 'root',
          spanType: 'agent_run' as const,
          isEvent: false,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          endedAt: new Date('2026-01-01T00:00:01Z'),
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: null,
        },
      ],
    };

    it('a backend overriding only getStructure resolves both methods', async () => {
      class StructureOnly extends ObservabilityStorage {
        override async getStructure() {
          return fakeResponse;
        }
      }
      const s = new StructureOnly();
      await expect(s.getStructure({ traceId: 't1' })).resolves.toEqual(fakeResponse);
      await expect(s.getTraceLight({ traceId: 't1' })).resolves.toEqual(fakeResponse);
    });

    it('a backend overriding only getTraceLight resolves both methods', async () => {
      class LightOnly extends ObservabilityStorage {
        override async getTraceLight() {
          return fakeResponse;
        }
      }
      const s = new LightOnly();
      await expect(s.getTraceLight({ traceId: 't1' })).resolves.toEqual(fakeResponse);
      await expect(s.getStructure({ traceId: 't1' })).resolves.toEqual(fakeResponse);
    });

    it('a backend overriding neither throws on both with distinct error ids', async () => {
      const s = new ObservabilityStorage();
      await expect(s.getStructure({ traceId: 't1' })).rejects.toThrow('does not support getting trace structure');
      await expect(s.getTraceLight({ traceId: 't1' })).rejects.toThrow('does not support getting lightweight traces');
    });
  });

  describe('listTracesLight fallback', () => {
    const fullTraceSpan = {
      traceId: 't1',
      spanId: 's1',
      parentSpanId: null,
      name: 'agent run',
      spanType: 'agent_run' as const,
      isEvent: false,
      startedAt: new Date('2026-01-01T00:00:00Z'),
      endedAt: new Date('2026-01-01T00:00:01Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: null,
      status: 'success' as const,
      entityType: null,
      entityId: null,
      entityName: null,
      error: null,
      input: { messages: [{ role: 'user', content: 'summarize this thread' }] },
      output: { text: 'x'.repeat(10_000) },
      attributes: { model: 'claude-sonnet-4-6' },
      metadata: { environment: 'production' },
    };

    // Mirrors what a backend without a dedicated lightweight query returns.
    class TracesOnly extends ObservabilityStorage {
      override async listTraces() {
        return {
          pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
          spans: [fullTraceSpan],
        };
      }
    }

    it('serves lightweight rows on a backend that only implements listTraces', async () => {
      const s = new TracesOnly();

      const { spans } = await s.listTracesLight({ pagination: { page: 0, perPage: 10 } });

      expect(spans).toHaveLength(1);
      const row = spans[0]! as Record<string, unknown>;
      expect(row.traceId).toBe('t1');
      expect(row.input).toBeUndefined();
      expect(row.output).toBeUndefined();
      expect(row.attributes).toBeUndefined();
      // The preview column still renders — derived from `input` on the way out.
      expect(row.inputPreview).toBe('summarize this thread');
      // Status and metadata survive projection so configurable list columns render.
      expect(row.status).toBe('success');
      expect(row.metadata).toEqual({ environment: 'production' });
    });

    it('computes status on projected rows from error and endedAt', async () => {
      const rows = [
        { ...fullTraceSpan, spanId: 'errored', error: { message: 'boom' }, status: 'error' as const },
        { ...fullTraceSpan, spanId: 'running', endedAt: null, status: 'running' as const },
        fullTraceSpan,
      ];
      class ThreeStates extends ObservabilityStorage {
        override async listTraces() {
          return {
            pagination: { total: 3, page: 0, perPage: 10, hasMore: false },
            spans: rows,
          };
        }
      }
      const s = new ThreeStates();

      const { spans } = await s.listTracesLight({ pagination: { page: 0, perPage: 10 } });

      const statusBySpanId = Object.fromEntries(spans.map(row => [row.spanId, row.status]));
      expect(statusBySpanId).toEqual({ errored: 'error', running: 'running', s1: 'success' });
    });

    it('preserves pagination metadata from listTraces', async () => {
      const s = new TracesOnly();

      const result = await s.listTracesLight({ pagination: { page: 0, perPage: 10 } });

      expect(result.pagination).toEqual({ total: 1, page: 0, perPage: 10, hasMore: false });
    });

    it('passes delta metadata through and projects rows light in delta mode', async () => {
      class DeltaTraces extends ObservabilityStorage {
        override async listTraces() {
          return {
            delta: { limit: 100, hasMore: true },
            deltaCursor: 'cursor-after',
            spans: [fullTraceSpan],
          };
        }
      }
      const s = new DeltaTraces();

      const result = await s.listTracesLight({ mode: 'delta', after: 'cursor-before', limit: 100 });

      expect(result.delta).toEqual({ limit: 100, hasMore: true });
      expect(result.deltaCursor).toBe('cursor-after');
      const row = result.spans[0]! as Record<string, unknown>;
      expect(row.input).toBeUndefined();
      expect(row.inputPreview).toBe('summarize this thread');
      expect(row.status).toBe('success');
      expect(row.metadata).toEqual({ environment: 'production' });
    });

    it('still throws when the backend implements neither', async () => {
      const s = new ObservabilityStorage();

      await expect(s.listTracesLight({})).rejects.toThrow('does not support listing traces');
    });
  });
});
