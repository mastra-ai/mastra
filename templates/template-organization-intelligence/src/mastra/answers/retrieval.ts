import { randomUUID } from 'node:crypto';
import type { SourceIndex } from '../workspaces/source-index.js';
import {
  boundedEvidence,
  boundedSourceStatus,
  isNativeStudioMessage,
  latestQuestionMessage,
  questionFromMessage,
} from './evidence.js';
import type { QueryContextualizer } from './query-context.js';
import { conversationHistory, resolveSearchQuery } from './query-context.js';
import type { ProcessorState } from './schema.js';
import { MAX_QUESTION_CHARACTERS } from './schema.js';

export async function prepareGrounding(
  index: SourceIndex,
  messages: Parameters<typeof latestQuestionMessage>[0],
  state: ProcessorState,
  contextualize?: QueryContextualizer,
  abortSignal?: AbortSignal,
): Promise<void> {
  const questionMessage = latestQuestionMessage(messages);
  state.presentation = isNativeStudioMessage(questionMessage) ? 'studio' : 'structured';
  const question = questionFromMessage(questionMessage);
  if (!question.trim() || question.length > MAX_QUESTION_CHARACTERS)
    throw new Error('Use a non-empty question of at most 4000 characters.');
  const startedAt = performance.now();
  state.startedAt = startedAt;
  state.correlationId = randomUUID();
  const resolution = await resolveSearchQuery(question, conversationHistory(messages), contextualize, abortSignal);
  state.contextualizationAttempted = resolution.attempted;
  state.contextualizationUsage = resolution.usage;
  if (resolution.decision.action === 'clarify') {
    state.clarification = resolution.decision.text;
    state.evidence = [];
    state.sourceStatus = [];
    state.retrievalMs = Math.round(performance.now() - startedAt);
    return;
  }
  state.searchQuery = resolution.decision.text;
  try {
    const hits = await index.search(state.searchQuery, 6);
    state.sourceStatus = index.sourceStatus();
    state.promptSourceStatus = boundedSourceStatus(state.sourceStatus);
    state.evidence = boundedEvidence(hits, state.promptSourceStatus);
  } catch {
    state.operationalFailure = true;
    state.evidence = [];
    try {
      state.sourceStatus = index.sourceStatus();
      state.promptSourceStatus = boundedSourceStatus(state.sourceStatus);
    } catch {
      state.sourceStatus = [];
      state.promptSourceStatus = [];
    }
  }
  state.retrievalMs = Math.round(performance.now() - startedAt);
}
