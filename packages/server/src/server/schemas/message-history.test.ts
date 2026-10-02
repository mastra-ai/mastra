import { describe, expect, it } from 'vitest';
import { lastMessagesSchema, messageHistorySchema } from './message-history';

describe('lastMessages schema', () => {
  it.each([false, 10, 0])('accepts %j', value => {
    expect(lastMessagesSchema.parse(value)).toEqual(value);
  });
  it.each([-1, 1.5, NaN, Infinity, { maxTokens: 10 }])('rejects %j', value => {
    expect(lastMessagesSchema.safeParse(value).success).toBe(false);
  });
});

describe('messageHistory schema', () => {
  it.each([{ maxTokens: 1000 }, { maxTokens: 1000, atMaxRemoveTokens: 250 }])('accepts %j', value => {
    expect(messageHistorySchema.parse(value)).toEqual(value);
  });
  it.each([
    {},
    { maxTokens: -1 },
    { maxTokens: Infinity },
    { atMaxRemoveTokens: 1 },
    { maxTokens: 5, atMaxRemoveTokens: 6 },
  ])('rejects %j', value => {
    expect(messageHistorySchema.safeParse(value).success).toBe(false);
  });
});
