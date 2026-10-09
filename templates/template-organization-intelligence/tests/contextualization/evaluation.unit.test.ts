import { describe, expect, it, vi } from 'vitest';
import {
  checkConversationQuery,
  evaluateConversationQueries,
} from '../../src/mastra/evaluation/conversation-queries.js';
import { CONVERSATION_QUERY_CASES } from '../../src/mastra/evaluation/fixtures/conversations.js';

describe('conversation query evaluation', () => {
  it('fails if the rewrite changes topic, omits a reference or guesses an ambiguous subject', () => {
    expect(
      checkConversationQuery(CONVERSATION_QUERY_CASES[1]!, { action: 'search', text: 'Who approves invoices?' }),
    ).not.toEqual([]);
    expect(
      checkConversationQuery(CONVERSATION_QUERY_CASES[0]!, { action: 'search', text: 'Who approves disposal?' }),
    ).not.toEqual([]);
    expect(
      checkConversationQuery(CONVERSATION_QUERY_CASES[4]!, {
        action: 'search',
        text: 'Who approves invoice disposal?',
      }),
    ).not.toEqual([]);
  });

  it('records failures and continues through the bounded synthetic suite', async () => {
    const contextualize = vi.fn().mockRejectedValue(new Error('provider unavailable'));
    const report = await evaluateConversationQueries(contextualize);
    expect(contextualize).toHaveBeenCalledTimes(7);
    expect(report).toMatchObject({ passed: false, caseCount: 7 });
    expect(report.cases.every(test => test.failures.length > 0)).toBe(true);
  });
});
