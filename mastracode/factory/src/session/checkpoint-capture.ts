import type { SessionBeforeAgentEndListener } from '@mastra/core/agent-controller';
import type { WorkspaceSandbox } from '@mastra/core/workspace';

export interface CheckpointCaptureSession {
  getWorkspace(): { sandbox?: Pick<WorkspaceSandbox, 'snapshot'> } | undefined;
  onBeforeAgentEnd(listener: SessionBeforeAgentEndListener): () => void;
}

/**
 * Snapshot the session's sandbox before every agent-end event so providers
 * with checkpoint support (for example Railway-backed sandboxes) persist the
 * last completed turn's writes. Captures are chained sequentially so a slow
 * snapshot never overlaps the next one, but the chain is intentionally NOT
 * returned to the session: turn completion must never block on snapshot I/O.
 * Failures are logged rather than thrown so they never break the agent turn.
 */
export function observeSessionCheckpoint(session: CheckpointCaptureSession): () => void {
  let capture = Promise.resolve();
  return session.onBeforeAgentEnd(() => {
    capture = capture.then(async () => {
      // Chat-only sessions run without a workspace; there is nothing to snapshot.
      const sandbox = session.getWorkspace()?.sandbox;
      // Older sandbox implementations predate `snapshot()`; skip them quietly.
      if (typeof sandbox?.snapshot !== 'function') return;
      try {
        await sandbox.snapshot();
      } catch (error) {
        console.warn('[Factory checkpoint capture] Unable to snapshot sandbox.', error);
      }
    });
    // Fire-and-forget: do not gate the terminal agent event on the snapshot.
  });
}
