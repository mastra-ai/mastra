import { z } from 'zod';
import { latestQuestionMessage, questionFromMessage } from './evidence.js';
import { MAX_QUESTION_CHARACTERS } from './schema.js';

export const queryDecisionSchema = z.object({
  action: z.enum(['search', 'clarify']),
  text: z.string().trim().min(1).max(MAX_QUESTION_CHARACTERS),
});
export type QueryDecision = z.infer<typeof queryDecisionSchema>;
export type ConversationMessage = { role: 'user' | 'assistant'; content: string };
export type QueryContextualizer = (
  question: string,
  history: ConversationMessage[],
  abortSignal?: AbortSignal,
) => Promise<{ decision: QueryDecision; usage?: unknown }>;

/** Keep recent conversational text; omit tools, system messages and non-user signals. */
export function conversationHistory(messages: Parameters<typeof latestQuestionMessage>[0]): ConversationMessage[] {
  const current = latestQuestionMessage(messages);
  const history: ConversationMessage[] = [];
  let remaining = 6_000;
  for (let i = messages.lastIndexOf(current) - 1; i >= 0 && history.length < 6 && remaining > 0; i--) {
    const message = messages[i]!;
    const isUser = message.role === 'user' || (message.role === 'signal' && message.type === 'user');
    if (!isUser && message.role !== 'assistant') continue;
    const content = questionFromMessage(message).slice(0, Math.min(2_000, remaining)).trim();
    if (!content) continue;
    history.unshift({ role: isUser ? 'user' : 'assistant', content });
    remaining -= content.length;
  }
  return history.some(message => message.role === 'user') ? history : [];
}

export async function resolveSearchQuery(
  question: string,
  history: ConversationMessage[],
  contextualize: QueryContextualizer | undefined,
  abortSignal?: AbortSignal,
) {
  const original: QueryDecision = { action: 'search', text: question };
  if (!history.length || !contextualize) return { decision: original, attempted: false, usage: undefined };
  try {
    const result = await contextualize(question, history, abortSignal);
    return { decision: queryDecisionSchema.parse(result.decision), attempted: true, usage: result.usage };
  } catch {
    if (abortSignal?.aborted) throw abortSignal.reason;
    return { decision: original, attempted: true, usage: undefined };
  }
}
