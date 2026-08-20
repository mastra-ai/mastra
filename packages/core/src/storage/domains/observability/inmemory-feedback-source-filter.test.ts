import { assert, describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../mock';
import type { CreateFeedbackRecord } from './feedback';

function makeFeedback(feedbackId: string, sourceId: string | undefined): CreateFeedbackRecord {
  return {
    feedbackId,
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    traceId: 'trace-1',
    feedbackType: 'thumbs',
    feedbackSource: 'human',
    value: 1,
    sourceId,
  };
}

describe('ObservabilityInMemory feedback sourceId filtering', () => {
  it('lists only feedback matching the sourceId filter', async () => {
    const observability = new InMemoryStore().stores.observability;
    assert(observability);
    await observability.batchCreateFeedback({
      feedbacks: [
        makeFeedback('fb-1', 'message-abc'),
        makeFeedback('fb-2', 'message-def'),
        makeFeedback('fb-3', undefined),
      ],
    });

    const result = await observability.listFeedback({ filters: { sourceId: 'message-abc' } });
    expect(result.feedback).toHaveLength(1);
    expect(result.feedback[0]!.feedbackId).toBe('fb-1');
    expect(result.feedback[0]!.sourceId).toBe('message-abc');
  });

  it('returns all feedback when sourceId filter is absent', async () => {
    const observability = new InMemoryStore().stores.observability;
    assert(observability);
    await observability.batchCreateFeedback({
      feedbacks: [makeFeedback('fb-1', 'message-abc'), makeFeedback('fb-2', 'message-def')],
    });

    const result = await observability.listFeedback({});
    expect(result.feedback).toHaveLength(2);
  });

  it('deduplicates retried submissions with the same feedbackId', async () => {
    const observability = new InMemoryStore().stores.observability;
    assert(observability);
    await observability.createFeedback({ feedback: makeFeedback('fb-retry', 'message-abc') });
    // Retry with a fresh timestamp — must not create a duplicate record.
    await observability.createFeedback({
      feedback: { ...makeFeedback('fb-retry', 'message-abc'), timestamp: new Date('2026-01-01T00:00:05.000Z') },
    });

    const result = await observability.listFeedback({});
    expect(result.feedback).toHaveLength(1);
    expect(result.feedback[0]!.feedbackId).toBe('fb-retry');
  });
});
