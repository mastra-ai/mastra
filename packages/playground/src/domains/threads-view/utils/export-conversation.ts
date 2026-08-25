import type { FeedbackRecord } from '@mastra/core/storage';
import {
  getReadableTraceInput,
  getReadableTraceOutput,
} from '@mastra/playground-ui/domains/traces/utils/trace-review-utils';
import type { ConversationThread } from '../hooks/use-conversation-threads';

export function buildConversationExport(thread: ConversationThread, feedbackByTraceId: Map<string, FeedbackRecord[]>) {
  return {
    threadKey: thread.threadKey,
    exportedAt: new Date().toISOString(),
    actors: thread.actors,
    startedAt: thread.startedAt,
    lastActivityAt: thread.lastActivityAt,
    turns: thread.turns.map((turn, index) => {
      const feedback = feedbackByTraceId.get(turn.traceId) ?? [];
      return {
        turn: index + 1,
        traceId: turn.traceId,
        actor: turn.entityName ?? turn.name,
        status: turn.status,
        startedAt: turn.startedAt,
        endedAt: turn.endedAt,
        message: getReadableTraceInput(turn.input),
        response: getReadableTraceOutput(turn.output),
        reviews: feedback
          .filter(entry => entry.feedbackType === 'review')
          .map(entry => ({
            assessment: entry.value === 1 ? 'accurate' : entry.value === -1 ? 'potentially-unsafe' : 'needs-correction',
            note: entry.comment ?? null,
            reviewer: entry.feedbackUserId ?? null,
            timestamp: entry.timestamp,
          })),
        annotations: feedback
          .filter(entry => entry.feedbackType === 'annotation')
          .map(entry => ({
            quote: typeof entry.metadata?.quote === 'string' ? entry.metadata.quote : null,
            note: entry.comment ?? null,
            reviewer: entry.feedbackUserId ?? null,
            timestamp: entry.timestamp,
          })),
        raw: { input: turn.input ?? null, output: turn.output ?? null },
      };
    }),
  };
}

export function downloadConversationJson(threadKey: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `conversation-${threadKey.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
