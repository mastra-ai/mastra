import { describe, expect, it } from 'vitest';
import { ObservabilityStorage } from './base';

describe('ObservabilityStorage base class', () => {
  const storage = new ObservabilityStorage();

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

    // Scores
    {
      name: 'createScore',
      callThunk: () =>
        storage.createScore({
          score: {
            id: 's1',
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

    // Feedback
    {
      name: 'createFeedback',
      callThunk: () =>
        storage.createFeedback({
          feedback: {
            id: 'f1',
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
  ];

  it.each(methodCases)('$name throws not-implemented', async ({ callThunk, expectedMessage }) => {
    await expect(callThunk()).rejects.toThrow(expectedMessage);
  });
});
