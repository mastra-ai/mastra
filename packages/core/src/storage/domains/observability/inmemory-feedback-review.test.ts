import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../mock';

const timestamp = new Date('2026-09-01T12:00:00.000Z');

async function createStore() {
  const store = new InMemoryStore();
  const observability = await store.getStore('observability');
  if (!observability) {
    throw new Error('Observability storage is unavailable');
  }
  return observability;
}

describe('ObservabilityInMemory feedback review status', () => {
  it('stores new feedback as needing review and filters by status', async () => {
    const observability = await createStore();

    await observability.createFeedback({
      feedback: {
        feedbackId: 'feedback-1',
        timestamp,
        traceId: 'trace-1',
        feedbackSource: 'user',
        feedbackType: 'comment',
        value: 'Needs attention',
      },
    });
    await observability.createFeedback({
      feedback: {
        feedbackId: 'feedback-2',
        timestamp: new Date(timestamp.getTime() + 1),
        traceId: 'trace-2',
        feedbackSource: 'user',
        feedbackType: 'comment',
        value: 'Already handled',
        reviewStatus: 'reviewed',
      },
    });

    const needsReview = await observability.listFeedback({ filters: { reviewStatus: 'needs-review' } });
    const reviewed = await observability.listFeedback({ filters: { reviewStatus: 'reviewed' } });

    expect(needsReview.feedback.map(feedback => feedback.feedbackId)).toEqual(['feedback-1']);
    expect(needsReview.pagination?.total).toBe(1);
    expect(reviewed.feedback.map(feedback => feedback.feedbackId)).toEqual(['feedback-2']);
    expect(reviewed.pagination?.total).toBe(1);
  });

  it('updates review status by feedback id', async () => {
    const observability = await createStore();

    await observability.createFeedback({
      feedback: {
        feedbackId: 'feedback-1',
        timestamp,
        feedbackSource: 'user',
        feedbackType: 'rating',
        value: 2,
      },
    });

    const updated = await observability.updateFeedbackReviewStatus({
      feedbackId: 'feedback-1',
      reviewStatus: 'reviewed',
    });

    expect(updated.reviewStatus).toBe('reviewed');
    const result = await observability.listFeedback({ filters: { reviewStatus: 'reviewed' } });
    expect(result.feedback).toEqual([updated]);
  });

  it('rejects an unknown feedback id', async () => {
    const observability = await createStore();

    await expect(
      observability.updateFeedbackReviewStatus({ feedbackId: 'missing', reviewStatus: 'reviewed' }),
    ).rejects.toThrow('Feedback record not found');
  });
});
