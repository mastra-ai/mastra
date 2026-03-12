import { describe, expect, it } from 'vitest';
import { ObservabilityStorage } from './base';

describe('ObservabilityStorage base class', () => {
  const storage = new ObservabilityStorage();

  describe('log methods throw not-implemented', () => {
    it('batchCreateLogs', async () => {
      await expect(storage.batchCreateLogs({ logs: [] })).rejects.toThrow('does not support creating logs');
    });

    it('listLogs', async () => {
      await expect(storage.listLogs({})).rejects.toThrow('does not support listing logs');
    });
  });

  describe('metric methods throw not-implemented', () => {
    it('batchCreateMetrics', async () => {
      await expect(storage.batchCreateMetrics({ metrics: [] })).rejects.toThrow('does not support recording metrics');
    });

    it('getMetricAggregate', async () => {
      await expect(storage.getMetricAggregate({ name: 'test', aggregation: 'sum' })).rejects.toThrow(
        'does not support metric aggregation',
      );
    });

    it('getMetricBreakdown', async () => {
      await expect(
        storage.getMetricBreakdown({ name: 'test', groupBy: ['entityType'], aggregation: 'sum' }),
      ).rejects.toThrow('does not support metric breakdown');
    });

    it('getMetricTimeSeries', async () => {
      await expect(storage.getMetricTimeSeries({ name: 'test', interval: '1h', aggregation: 'sum' })).rejects.toThrow(
        'does not support metric time series',
      );
    });

    it('getMetricPercentiles', async () => {
      await expect(
        storage.getMetricPercentiles({ name: 'test', percentiles: [0.5, 0.95], interval: '1h' }),
      ).rejects.toThrow('does not support metric percentiles');
    });
  });

  describe('discovery methods throw not-implemented', () => {
    it('getMetricNames', async () => {
      await expect(storage.getMetricNames({})).rejects.toThrow('does not support metric name discovery');
    });

    it('getMetricLabelKeys', async () => {
      await expect(storage.getMetricLabelKeys({ metricName: 'test' })).rejects.toThrow(
        'does not support metric label key discovery',
      );
    });

    it('getMetricLabelValues', async () => {
      await expect(storage.getMetricLabelValues({ metricName: 'test', labelKey: 'key' })).rejects.toThrow(
        'does not support label value discovery',
      );
    });

    it('getEntityTypes', async () => {
      await expect(storage.getEntityTypes({})).rejects.toThrow('does not support entity type discovery');
    });

    it('getEntityNames', async () => {
      await expect(storage.getEntityNames({})).rejects.toThrow('does not support entity name discovery');
    });

    it('getServiceNames', async () => {
      await expect(storage.getServiceNames({})).rejects.toThrow('does not support service name discovery');
    });

    it('getEnvironments', async () => {
      await expect(storage.getEnvironments({})).rejects.toThrow('does not support environment discovery');
    });

    it('getTags', async () => {
      await expect(storage.getTags({})).rejects.toThrow('does not support tag discovery');
    });
  });

  describe('score methods throw not-implemented', () => {
    it('createScore', async () => {
      await expect(
        storage.createScore({
          score: {
            id: 's1',
            timestamp: new Date(),
            traceId: 't1',
            scorerId: 'test',
            score: 0.5,
          },
        }),
      ).rejects.toThrow('does not support creating scores');
    });

    it('listScores', async () => {
      await expect(storage.listScores({})).rejects.toThrow('does not support listing scores');
    });
  });

  describe('feedback methods throw not-implemented', () => {
    it('createFeedback', async () => {
      await expect(
        storage.createFeedback({
          feedback: {
            id: 'f1',
            timestamp: new Date(),
            traceId: 't1',
            source: 'user',
            feedbackType: 'thumbs',
            value: 1,
          },
        }),
      ).rejects.toThrow('does not support creating feedback');
    });

    it('listFeedback', async () => {
      await expect(storage.listFeedback({})).rejects.toThrow('does not support listing feedback');
    });
  });
});
