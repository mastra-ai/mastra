import type { CreateFeedbackRecord } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { feedbackRecordToRow, rowToFeedbackRecord } from './helpers';

describe('feedback attribution row conversion', () => {
  it.each(['reviewer', null])('round-trips author %j separately from the span user', feedbackUserId => {
    const feedback: CreateFeedbackRecord = {
      feedbackId: 'feedback',
      traceId: 'trace',
      timestamp: new Date('2026-01-01T00:00:00Z'),
      feedbackType: 'thumbs',
      value: 1,
      userId: 'span-user',
      feedbackUserId,
    };
    const row = feedbackRecordToRow(feedback);
    expect(row).toMatchObject({ userId: 'span-user', feedbackUserId });
    expect(rowToFeedbackRecord(row)).toMatchObject({ userId: 'span-user', feedbackUserId });
  });
});
