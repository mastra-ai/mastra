import { describe, expect, it } from 'vitest';
import { lastMessagesSchema } from './last-messages';

describe('lastMessages schema', () => {
  it.each([
    false,
    10,
    { maxMessages: 20 },
    { maxTokens: 1000 },
    { maxMessages: 30, maxTokens: 1000, atMaxRemoveTokens: 250 },
  ])('accepts %j', value => {
    expect(lastMessagesSchema.parse(value)).toEqual(value);
  });
  it.each([
    { maxTokens: -1 },
    { maxTokens: Infinity },
    { maxMessages: 1.5 },
    { atMaxRemoveTokens: 1 },
    { maxTokens: 5, atMaxRemoveTokens: 6 },
  ])('rejects %j', value => {
    expect(lastMessagesSchema.safeParse(value).success).toBe(false);
  });
});
