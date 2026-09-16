import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';

export interface FirstMessageCaptureSession {
  readonly identity: { getResourceId(): string };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

export interface FirstMessageCaptureDependencies {
  sourceControl: {
    sessions: Pick<SourceControlStorageHandle['sessions'], 'markFirstMessage'>;
  };
}

/**
 * Record when a session's agent first produced an actual conversational
 * message (the TTFI anchor — "time to first interaction").
 *
 * We stamp on the first `message_start` whose role is `user` or `assistant`.
 * The coordinator writes `role='signal'` rows into the thread (skill loads,
 * phase markers, memory reminders) before the model is ever invoked; those
 * signals used to trigger a stamp via `agent_start`, giving every session —
 * including zero-message model-init failures — a false TTFI of a few seconds.
 * Gating on real conversational roles keeps the TTFI column honest: sessions
 * that never produced a user or assistant message stay NULL and drop out of
 * TTFI percentiles instead of contaminating them.
 *
 * The listener unsubscribes after the first qualifying message; the storage
 * write is guarded (`first_message_at IS NULL`), so restarts, re-materialized
 * sessions, and sessions without a source-control row (chat-only channels)
 * are no-ops.
 */
export function observeSessionFirstMessage(
  session: FirstMessageCaptureSession,
  { sourceControl }: FirstMessageCaptureDependencies,
): () => void {
  let seen = false;
  const unsubscribe = session.subscribe(event => {
    if (seen || event.type !== 'message_start') return;
    const role = event.message.role;
    if (role !== 'user' && role !== 'assistant') return;
    seen = true;
    unsubscribe();
    void sourceControl.sessions
      .markFirstMessage({ sessionId: session.identity.getResourceId() })
      .catch(error => console.warn('[Factory first-message capture] Unable to persist first message time.', error));
  });
  return unsubscribe;
}
