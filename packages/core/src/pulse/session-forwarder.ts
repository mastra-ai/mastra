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

/**
 * Minimal deepClean equivalent (core cannot import @mastra/observability's):
 * session events are typed as scalars today, but nothing enforces it, and one
 * BigInt or cycle in an attribute would poison a ClickHouse-style
 * JSON.stringify for the whole batch downstream. Depth-capped, cycle-guarded,
 * BigInt-coerced; functions/symbols dropped.
 */
function sanitizeValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value == null) return value;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return value;
  if (t === 'bigint') {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : String(value);
  }
  if (t === 'function' || t === 'symbol') return undefined;
  if (depth >= 4) return '[Truncated]';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[Circular]';
    seen.add(value as object);
    if (Array.isArray(value)) return value.slice(0, 50).map(v => sanitizeValue(v, depth + 1, seen));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = sanitizeValue(v, depth + 1, seen);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return undefined;
}

export interface SessionPulseForwarderOptions {
  session: PulseForwardableSession;
  bus: PulseBus;
  /** Read at event time — a session's thread binding changes over its life. */
  getThreadId?: () => string | null | undefined;
  getResourceId?: () => string | null | undefined;
  /**
   * Read at event time. The session's run tracker keeps the id until
   * `run.reset()`, which happens after `agent_end` is dispatched — so terminal
   * events still see the id of the run they end. This is what makes abort
   * attribution an exact join instead of a thread+time-window guess.
   */
  getRunId?: () => string | null | undefined;
}

export interface SessionPulseForwarderHandle {
  /** Unsubscribe from the session bus. */
  detach(): void;
  /** Events the forwarder failed to translate (never breaks the session). */
  readonly failedEventCount: number;
  /**
   * Record the terminal abort outcome directly, bypassing the session bus.
   * deleteSession tears the stream down synchronously after abort(), which
   * suppresses the engine's own `agent_end{aborted}` emission (its stream
   * guard fails) — so on that path the controller states the fact itself,
   * with the run id it captured before teardown.
   */
  recordAbortOutcome(runId: string): void;
}

/**
 * Subscribe a pulse forwarder to a session's bus. Returns a handle the
 * AgentController uses to detach on teardown (and to record the abort
 * outcome on the deleteSession path, where the engine's terminal event is
 * suppressed).
 */
export function attachSessionPulseForwarder(options: SessionPulseForwarderOptions): SessionPulseForwarderHandle {
  const { session, bus, getThreadId, getResourceId, getRunId } = options;

  const emit = (
    surface: string,
    action: string,
    type: PulseSemanticType,
    attributes: Record<string, unknown>,
    explicitRunId?: string,
  ) => {
    const threadId = getThreadId?.() ?? undefined;
    const resourceId = getResourceId?.() ?? undefined;
    // An event-carried run id wins (e.g. follow_up_queued names the run that
    // drained it); otherwise stamp the session's current run.
    const runId = explicitRunId ?? getRunId?.() ?? undefined;
    const id = randomUUID();
    bus.emit({
      type: 'pulse',
      record: {
        id,
        timestamp: new Date(),
        seq: nextPulseSeq(),
        type,
        surface,
        action,
        attributes: sanitizeValue(attributes) as Record<string, unknown>,
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
    return { pulseId: id, threadId, runId };
  };

  /** Run ids whose terminal outcome was already recorded (dedup guard). */
  const terminalRecorded = new Set<string>();
  let failedEvents = 0;

  const recordTerminal = (reason: string, runId?: string) => {
    if (runId) {
      if (terminalRecorded.has(runId)) return;
      terminalRecorded.add(runId);
    }
    emit('agent_controller', 'agent_end', 'state', { reason }, runId);
    if (reason === 'aborted') emit('run_control', 'abort_completed', 'state', {}, runId);
  };

  const unsubscribe = session.subscribe((event: any) => {
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
          recordTerminal(event.reason ?? 'complete', getRunId?.() ?? undefined);
          break;
        case 'follow_up_queued': {
          const { pulseId, threadId, runId } = emit(
            'thread_control',
            'follow_up_queued',
            'state',
            { count: event.count },
            event.runId,
          );
          // The session lane's first graph edge: the thread queued this fact.
          // (Session pulses have no traceId, so `flow_contains` is not
          // possible here — runId is their exact join key; memo item.)
          if (threadId) {
            bus.emit({
              type: 'relationship',
              record: {
                id: randomUUID(),
                timestamp: new Date(),
                seq: nextPulseSeq(),
                type: 'queued_follow_up',
                from: { kind: 'thread', id: threadId },
                to: { kind: 'pulse', id: pulseId },
                ...(runId ? { attributes: { runId } } : {}),
                traceId: '',
              },
            });
          }
          break;
        }
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
      // Never let pulse capture break the session — but count the loss so a
      // systematic mapping bug is observable (the rest of the pipeline counts
      // its drops too).
      failedEvents++;
    }
  });

  return {
    detach: unsubscribe,
    get failedEventCount() {
      return failedEvents;
    },
    recordAbortOutcome: (runId: string) => {
      try {
        recordTerminal('aborted', runId);
      } catch {
        // never let pulse capture break session teardown
      }
    },
  };
}
