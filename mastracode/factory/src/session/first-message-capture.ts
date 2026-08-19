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
 * Record when a session's agent first started working on a message.
 *
 * `agent_start` is the earliest reliable session event for "a message reached
 * the agent": it fires when the run engine begins processing an accepted
 * message — a user's chat message, a factory run's kickoff prompt, or a
 * channel message — for every session kind (user, work, review). The plain
 * user message itself is never emitted as a `message_start` event, so the run
 * start is the observable proxy, milliseconds after arrival.
 *
 * The listener unsubscribes after the first event; the storage write is
 * guarded (`first_message_at IS NULL`), so restarts, re-materialized sessions,
 * and sessions without a source-control row (chat-only channels) are no-ops.
 */
export function observeSessionFirstMessage(
  session: FirstMessageCaptureSession,
  { sourceControl }: FirstMessageCaptureDependencies,
): () => void {
  let seen = false;
  const unsubscribe = session.subscribe(event => {
    if (seen || event.type !== 'agent_start') return;
    seen = true;
    unsubscribe();
    void sourceControl.sessions
      .markFirstMessage({ sessionId: session.identity.getResourceId() })
      .catch(error => console.warn('[Factory first-message capture] Unable to persist first message time.', error));
  });
  return unsubscribe;
}
