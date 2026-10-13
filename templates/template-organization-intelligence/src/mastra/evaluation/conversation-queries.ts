import type { QueryContextualizer, QueryDecision } from '../answers/query-context.js';
import { queryDecisionSchema } from '../answers/query-context.js';
import { CONVERSATION_QUERY_CASES } from './fixtures/conversations.js';
import type { ConversationQueryCase } from './fixtures/conversations.js';

export function checkConversationQuery(test: ConversationQueryCase, decision: QueryDecision): string[] {
  const failures: string[] = [];
  const text = decision.text.toLowerCase();
  if (decision.action !== test.expectedAction) failures.push('Unexpected action.');
  if (test.preserveQuestion && decision.text !== test.question) failures.push('Changed a self-contained question.');
  for (const term of test.requiredTerms ?? []) if (!text.includes(term)) failures.push(`Missing reference: ${term}.`);
  for (const term of test.excludedTerms ?? [])
    if (text.includes(term)) failures.push(`Retained superseded reference: ${term}.`);
  return failures;
}

/** Bounded model smoke evaluation of references and decisions, not a semantic judge of answers. */
export async function evaluateConversationQueries(contextualize: QueryContextualizer) {
  const cases = [];
  for (const test of CONVERSATION_QUERY_CASES) {
    try {
      const { decision, usage } = await contextualize(test.question, test.history);
      const validated = queryDecisionSchema.parse(decision);
      const failures = checkConversationQuery(test, validated);
      cases.push({ id: test.id, decision: validated, usage, failures, passed: failures.length === 0 });
    } catch {
      cases.push({ id: test.id, failures: ['Contextualization failed.'], passed: false });
    }
  }
  return { passed: cases.every(test => test.passed), caseCount: cases.length, cases };
}
