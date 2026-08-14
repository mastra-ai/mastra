import { randomUUID } from 'node:crypto';
import type { PulseSemanticType } from '../storage/domains/pulse';
import type { PulseBus } from './bus';
import { nextPulseSeq } from './seq';

/**
 * Native session → pulse forwarding (experimental).
 *
 * Spans miss session-layer facts (tool approvals, the TRUE abort outcome,
 * follow-up queueing, mode/model switches). When `pulse` is configured on
 * Mastra, the AgentController attaches this forwarder to every session it
 * creates: a single subscription on the session's existing bus that translates
 * a whitelist of events into pulse records on the {@link PulseBus} — zero
 * changes at the emit sites, no per-session wiring in user land.
 *
 * Deliberately skipped (high-volume, span- or read-model-covered):
 * `state_changed`, all `message_*` events, tool/stream deltas.
 */

/** Structural subset of an AgentController session the forwarder needs. */
export interface PulseForwardableSession {
  subscribe(listener: (event: any) => void): () => void;
}

export interface SessionPulseForwarderOptions {
  session: PulseForwardableSession;
  bus: PulseBus;
  /** Read at event time — a session's thread binding changes over its life. */
  getThreadId?: () => string | null | undefined;
  getResourceId?: () => string | null | undefined;
}

/**
 * Subscribe a pulse forwarder to a session's bus. Returns the unsubscribe
 * function; the AgentController calls it when the session is torn down.
 */
export function attachSessionPulseForwarder(options: SessionPulseForwarderOptions): () => void {
  const { session, bus, getThreadId, getResourceId } = options;

  const emit = (
    surface: string,
    action: string,
    type: PulseSemanticType,
    attributes: Record<string, unknown>,
    runId?: string,
  ) => {
    const threadId = getThreadId?.() ?? undefined;
    const resourceId = getResourceId?.() ?? undefined;
    bus.emit({
      type: 'pulse',
      record: {
        id: randomUUID(),
        timestamp: new Date(),
        seq: nextPulseSeq(),
        type,
        surface,
        action,
        attributes,
        metadata: {
          ...(runId ? { runId } : {}),
          ...(threadId ? { threadId } : {}),
          ...(resourceId ? { resourceId } : {}),
        },
        traceId: '',
        runId,
        threadId: threadId || undefined,
        resourceId: resourceId || undefined,
        source: 'session',
      },
    });
  };

  return session.subscribe((event: any) => {
    try {
      switch (event?.type) {
        case 'tool_approval_required':
          emit('tool_approval', 'required', 'decision', {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
          });
          break;
        case 'agent_end':
          // The span layer records aborted runs as completed; the session-layer
          // reason is the authoritative outcome (read models let it override).
          emit('agent_controller', 'agent_end', 'state', { reason: event.reason ?? 'complete' });
          if (event.reason === 'aborted') emit('run_control', 'abort_completed', 'state', {});
          break;
        case 'follow_up_queued':
          emit('thread_control', 'follow_up_queued', 'state', { count: event.count }, event.runId);
          break;
        case 'mode_changed':
          emit('agent_config', 'mode_changed', 'state', { modeId: event.modeId ?? event.mode });
          break;
        case 'model_changed':
          emit('agent_config', 'model_changed', 'state', { modelId: event.modelId ?? event.model });
          break;
        case 'tool_suspended':
          emit('tool', 'suspended', 'state', { toolCallId: event.toolCallId, toolName: event.toolName });
          break;
        case 'tool_suspension_cancelled':
          emit('tool', 'suspension_cancelled', 'state', {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            reason: event.reason,
          });
          break;
        default:
          break;
      }
    } catch {
      // never let pulse capture break the session
    }
  });
}
