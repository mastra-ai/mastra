import { describe, expect, it } from 'vitest';
import { createFeedbackBodySchema, createFeedbackArgsSchema, feedbackRecordSchema } from './feedback';
import { createScoreBodySchema, createScoreArgsSchema, scoreRecordSchema } from './scores';

describe.each([
  {
    field: 'feedback',
    body: createFeedbackBodySchema,
    args: createFeedbackArgsSchema,
    record: feedbackRecordSchema,
    data: { feedbackType: 'thumbs', value: 1 },
  },
  {
    field: 'score',
    body: createScoreBodySchema,
    args: createScoreArgsSchema,
    record: scoreRecordSchema,
    data: { scorerId: 'accuracy', score: 0.9 },
  },
])('$field HTTP write schema', ({ field, body, args, record, data }) => {
  it.each([undefined, null, '', ' ', '\t\n'])('rejects traceId %j, even with a span ID', traceId => {
    for (const spanId of [undefined, 'span-123']) {
      const result = body.safeParse({ [field]: { ...data, traceId, spanId } });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues.some(issue => issue.path.join('.') === `${field}.traceId`)).toBe(true);
    }
  });

  it.each([undefined, 'span-123'])('accepts a trace with spanId %j without rewriting its ID', spanId => {
    const input = { [field]: { ...data, traceId: ' trace-123 ', spanId } };
    expect(body.parse(input)).toEqual(input);
  });

  it('keeps nullable trace IDs valid in storage and historical records', () => {
    const value = { ...data, traceId: null, timestamp: new Date(), reviewStatus: 'needs-review' };
    expect(args.parse({ [field]: value })).toMatchObject({ [field]: { traceId: null } });
    expect(record.parse(value)).toMatchObject({ traceId: null });
  });
});

describe('feedback storage attribution', () => {
  it('preserves an explicitly absent author without consuming the span user', () => {
    const { feedback } = createFeedbackArgsSchema.parse({
      feedback: {
        timestamp: new Date(),
        traceId: 'trace',
        feedbackType: 'thumbs',
        value: 1,
        userId: 'span-user',
        feedbackUserId: null,
      },
    });
    expect(feedback).toMatchObject({ userId: 'span-user', feedbackUserId: null });
  });
});
