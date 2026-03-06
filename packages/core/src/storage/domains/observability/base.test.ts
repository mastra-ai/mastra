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
    it('batchRecordMetrics', async () => {
      await expect(storage.batchRecordMetrics({ metrics: [] })).rejects.toThrow('does not support recording metrics');
    });

    it('listMetrics', async () => {
      await expect(storage.listMetrics({})).rejects.toThrow('does not support listing metrics');
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
            scorerName: 'test',
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
