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

    // Traces
    {
      name: 'getTraceLight',
      callThunk: () => storage.getTraceLight({ traceId: 'test' }),
      expectedMessage: 'does not support getting lightweight traces',
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
});
