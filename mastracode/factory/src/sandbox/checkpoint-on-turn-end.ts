/**
 * Turn-end checkpoint capture for factory sessions.
 *
 * Subscribes to a session's `agent_end` event and fires `captureCheckpoint()`
 * on the current materialization sandbox. This is what makes Railway's
 * idle-destroy race window irrelevant in practice: a session that goes idle
 * after a turn already has a fresh checkpoint on disk, so a subsequent VM
 * reap loses nothing — the next `_start()` recovers from the checkpoint
 * name the workspace was constructed with.
 *
 * Capture failures never propagate. The turn has already produced its
 * user-visible result by the time `agent_end` fires; failing the session
 * over a best-effort persistence operation would trade real work for a
 * transient upstream hiccup. The upstream refresh timer (widened in
 * `@mastra/railway` / `@platform/workspaces`) is still armed as a safety
 * net for exactly this case.
 */

import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import type { CaptureCheckpointResult, MaterializationSandbox } from './fleet.js';

type AgentEndReason = Extract<AgentControllerEvent, { type: 'agent_end' }>['reason'];

/**
 * Anything with a `subscribe(listener)` that returns an unsubscribe function.
 * Structurally matches `AgentController.Session` without pulling the whole
 * type surface in — the workspace layer holds the concrete session and this
 * helper only needs to listen.
 */
export interface CheckpointSubscribable {
  subscribe(listener: (event: AgentControllerEvent) => void | Promise<void>): () => void;
}

/**
 * Minimal logger surface the hook needs. `warn` for failed captures (an
 * on-call signal that the upstream is unhealthy), `debug` for skipped/OK
 * captures (routine turn-end noise).
 */
export interface CheckpointHookLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

export interface SubscribeCheckpointOnTurnEndArgs {
  /** Session whose `agent_end` events drive captures. */
  session: CheckpointSubscribable;
  /**
   * Sandbox to capture against. If it lacks `captureCheckpoint` (e.g. a
   * LocalSandbox-backed materialization) the subscription is skipped
   * entirely — a missing method is a provider-level "no checkpoints here"
   * signal, not a bug to surface.
   */
  sandbox: MaterializationSandbox;
  /** Session id, included in log meta so operators can correlate captures to sessions. */
  sessionId: string;
  logger: CheckpointHookLogger;
}

/**
 * Wire turn-end capture on `session`. Returns an unsubscribe function the
 * caller invokes when the session/workspace is torn down. If the sandbox
 * has no `captureCheckpoint` capability the returned unsubscribe is a no-op
 * (no listener was registered).
 *
 * The listener is deliberately synchronous: it fires the async capture
 * (`void`ed) and returns immediately so the event bus is never blocked on
 * an HTTP round-trip. Concurrent turn-ends on the same sandbox are
 * coalesced upstream (client-side in `PlatformSandbox`, in-flight join in
 * `RailwaySandbox`), so a burst of `agent_end` events collapses to at most
 * one upstream capture.
 */
export function subscribeCheckpointOnTurnEnd(args: SubscribeCheckpointOnTurnEndArgs): () => void {
  const { session, sandbox, sessionId, logger } = args;
  const capture = sandbox.captureCheckpoint;
  if (!capture) return () => {};

  const boundCapture = capture.bind(sandbox);
  return session.subscribe(event => {
    if (event.type !== 'agent_end') return;
    void runCapture({ capture: boundCapture, sessionId, reason: event.reason, logger });
  });
}

async function runCapture(args: {
  capture: () => Promise<CaptureCheckpointResult>;
  sessionId: string;
  reason: AgentEndReason;
  logger: CheckpointHookLogger;
}): Promise<void> {
  const { capture, sessionId, reason, logger } = args;
  try {
    const result = await capture();
    switch (result.status) {
      case 'captured':
      case 'coalesced':
        logger.debug('captureCheckpoint on turn-end', {
          sessionId,
          agentEndReason: reason,
          status: result.status,
          checkpointName: result.checkpointName,
        });
        return;
      case 'skipped':
        logger.debug('captureCheckpoint on turn-end skipped', {
          sessionId,
          agentEndReason: reason,
          reason: result.reason,
        });
        return;
    }
  } catch (error) {
    // Never fail the turn: the user already got their response. The upstream
    // refresh timer is still armed and will retry.
    logger.warn('captureCheckpoint on turn-end failed', {
      sessionId,
      agentEndReason: reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
