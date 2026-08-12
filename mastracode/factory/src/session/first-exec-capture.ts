import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';

export interface FirstExecCaptureSession {
  readonly identity: { getResourceId(): string };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

export interface FirstExecCaptureDependencies {
  sourceControl: {
    sessions: Pick<SourceControlStorageHandle['sessions'], 'markFirstMeaningfulExec'>;
  };
}

/**
 * Record when a session's agent completed its first successful sandbox exec
 * (the TTFME anchor — "time to first meaningful exec").
 *
 * `command_exit` is emitted only for the agent's own foreground
 * `execute_command` tool calls: direct `sandbox.executeCommand()` calls from
 * the skill loader / preflight / materializer never flow through the tool, so
 * the first successful exit event is definitionally the agent's first
 * meaningful exec — no command classifier needed. Background spawns emit no
 * exit event at spawn time and are intentionally excluded.
 *
 * Failed commands (nonzero exit) don't count; the listener stays subscribed
 * until a successful exit, then unsubscribes. The storage write is guarded
 * (`first_meaningful_exec_at IS NULL`), so restarts, re-materialized
 * sessions, and sessions without a source-control row are no-ops.
 */
export function observeSessionFirstExec(
  session: FirstExecCaptureSession,
  { sourceControl }: FirstExecCaptureDependencies,
): () => void {
  let seen = false;
  const unsubscribe = session.subscribe(event => {
    if (seen || event.type !== 'command_exit' || !event.success) return;
    seen = true;
    unsubscribe();
    void sourceControl.sessions
      .markFirstMeaningfulExec({ sessionId: session.identity.getResourceId() })
      .catch(error => console.warn('[Factory first-exec capture] Unable to persist first exec time.', error));
  });
  return unsubscribe;
}
