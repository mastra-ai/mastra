import { randomUUID } from 'node:crypto';
import type { PulseExporter } from './exporter';
import { chTime, nextSeq } from './exporter';

/**
 * Session listener companion to {@link PulseExporter}.
 *
 * Spans miss session-layer facts (tool approvals, the TRUE abort outcome,
 * follow-up queueing, mode/model switches). This helper subscribes to an Agent
 * Controller session's bus and writes those facts as pulse rows through the
 * exporter's batching writer, so both lanes share one write path and one
 * per-process ordering lane.
 *
 * The SessionBus dispatches events with no id envelope (it is per-session, so
 * identity is implicit in subscription scope) — callers pass threadId/
 * resourceId; runId is read from events that carry it.
 */

export interface PulseSessionIds {
  threadId?: string;
  resourceId?: string;
}

interface SubscribableSession {
  subscribe(listener: (event: any) => void): () => void;
}

export function attachPulseSession(
  session: SubscribableSession,
  exporter: PulseExporter,
  ids: PulseSessionIds = {},
): () => void {
  const writer = exporter.writer;
  if (!writer) return () => {};

  const emit = (
    surface: string,
    action: string,
    type: 'state' | 'decision' | 'system',
    attrs: Record<string, unknown>,
    runId?: string,
  ) => {
    writer.pushPulse({
      id: randomUUID(),
      timestamp: chTime(),
      seq: nextSeq(),
      type,
      surface,
      action,
      level: '',
      text: '',
      data: '{}',
      attributes: JSON.stringify(attrs),
      metadata: JSON.stringify({
        ...(runId ? { runId } : {}),
        ...(ids.threadId ? { threadId: ids.threadId } : {}),
        ...(ids.resourceId ? { resourceId: ids.resourceId } : {}),
      }),
      trace_id: '',
      span_id: '',
      parent_span_id: '',
      run_id: runId ?? '',
      thread_id: ids.threadId ?? '',
      resource_id: ids.resourceId ?? '',
      source: 'session',
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
        case 'follow_up_queued':
          emit('thread_control', 'follow_up_queued', 'state', { count: event.count }, event.runId);
          break;
        case 'mode_changed':
          emit('agent_config', 'mode_changed', 'state', { modeId: event.modeId ?? event.mode });
          break;
        case 'model_changed':
          emit('agent_config', 'model_changed', 'state', { modelId: event.modelId ?? event.model });
          break;
        case 'agent_end':
          // The span layer records aborted runs as completed; the session-layer
          // reason is the authoritative outcome (read models let it override).
          emit('agent_controller', 'agent_end', 'state', { reason: event.reason ?? 'complete' });
          if (event.reason === 'aborted') emit('run_control', 'abort_completed', 'state', {});
          break;
        default:
          break;
      }
    } catch {
      // never let pulse capture break the session
    }
  });
}
