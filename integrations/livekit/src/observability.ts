import { metrics, voice } from '@livekit/agents';
import type { Mastra } from '@mastra/core/mastra';
import { getOrCreateSpan, SpanType } from '@mastra/core/observability';
import type { Span, TracingContext } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';
import type { LiveKitSessionMetadata } from './metadata';

export interface VoiceCallObservabilityOptions {
  /** The Mastra instance whose observability config receives the spans. */
  mastra: Mastra;
  /** Resolved Mastra agent id/key answering the call (for span attribution). */
  agentId: string;
  /** LiveKit room name for this session. */
  roomName: string;
  /** Dispatch metadata for the session. */
  metadata: LiveKitSessionMetadata;
  /** Request context forwarded to span sampling. */
  requestContext?: RequestContext;
}

export interface VoiceCallObservability {
  /** The root `voice call` span. Each turn's agent run and every pipeline metric nests under it. */
  readonly span: Span<SpanType.GENERIC>;
  /** Thread into the bridge's `streamOptions` so each turn's agent run nests under the call. */
  readonly tracingContext: TracingContext;
  /** Subscribe to the session's `metrics_collected` events. Call once, before `session.start()`. */
  attach(session: voice.AgentSession): void;
  /** Close the call span with the usage roll-up. Idempotent; safe to call from a shutdown hook. */
  finalize(options?: { error?: unknown }): void;
}

function modelMeta(metadata?: metrics.MetricsMetadata): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (metadata?.modelProvider) out.modelProvider = metadata.modelProvider;
  if (metadata?.modelName) out.modelName = metadata.modelName;
  return out;
}

const ms = (n: number) => `${Math.round(n)}ms`;
const secs = (n: number) => `${(n / 1000).toFixed(1)}s`;

/**
 * Maps a LiveKit pipeline metric to an event-span name and the latency/usage fields worth
 * recording. The name carries the headline number so it reads in the trace timeline without
 * opening the span. Metrics this release does not surface (interruption, EOT inference, avatar)
 * return `undefined` — they still feed the session usage roll-up via the ModelUsageCollector.
 */
function describeMetric(metric: metrics.AgentMetrics): { name: string; data: Record<string, unknown> } | undefined {
  switch (metric.type) {
    case 'eou_metrics':
      // End-of-utterance: how long turn detection took to decide the caller finished.
      return {
        name: `eou ${ms(metric.endOfUtteranceDelayMs)}`,
        data: {
          endOfUtteranceDelayMs: metric.endOfUtteranceDelayMs,
          transcriptionDelayMs: metric.transcriptionDelayMs,
          onUserTurnCompletedDelayMs: metric.onUserTurnCompletedDelayMs,
        },
      };
    case 'stt_metrics':
      return {
        name: `stt ${secs(metric.audioDurationMs)}`,
        data: {
          audioDurationMs: metric.audioDurationMs,
          durationMs: metric.durationMs,
          streamed: metric.streamed,
          ...modelMeta(metric.metadata),
        },
      };
    case 'llm_metrics':
      // LiveKit's view of the reply latency (includes transport), distinct from the Mastra
      // agent-run model span: time-to-first-token is what the caller actually waits for.
      return {
        name: `llm ttft ${ms(metric.ttftMs)}`,
        data: {
          ttftMs: metric.ttftMs,
          durationMs: metric.durationMs,
          tokensPerSecond: metric.tokensPerSecond,
          promptTokens: metric.promptTokens,
          completionTokens: metric.completionTokens,
          totalTokens: metric.totalTokens,
          cancelled: metric.cancelled,
          ...modelMeta(metric.metadata),
        },
      };
    case 'tts_metrics':
      return {
        name: `tts ttfb ${ms(metric.ttfbMs)}`,
        data: {
          ttfbMs: metric.ttfbMs,
          durationMs: metric.durationMs,
          audioDurationMs: metric.audioDurationMs,
          charactersCount: metric.charactersCount,
          cancelled: metric.cancelled,
          streamed: metric.streamed,
          ...modelMeta(metric.metadata),
        },
      };
    case 'vad_metrics':
      return {
        name: 'vad',
        data: {
          idleTimeMs: metric.idleTimeMs,
          inferenceCount: metric.inferenceCount,
          inferenceDurationTotalMs: metric.inferenceDurationTotalMs,
        },
      };
    case 'realtime_model_metrics':
      return {
        name: `realtime ttft ${ms(metric.ttftMs)}`,
        data: {
          ttftMs: metric.ttftMs,
          durationMs: metric.durationMs,
          tokensPerSecond: metric.tokensPerSecond,
          promptTokens: metric.inputTokens,
          completionTokens: metric.outputTokens,
          totalTokens: metric.totalTokens,
          ...modelMeta(metric.metadata),
        },
      };
    default:
      return undefined;
  }
}

/**
 * Opens a `voice call` trace for one LiveKit session and bridges LiveKit's voice-pipeline
 * metrics into Mastra observability.
 *
 * The returned root span groups everything about the call: each conversation turn's Mastra
 * agent run (nested via {@link VoiceCallObservability.tracingContext}) plus an event span for
 * every STT, TTS, end-of-utterance, VAD, and LLM-latency metric LiveKit emits. Metrics are
 * point-in-time, so they're recorded as event spans (no duration) with the value in the name.
 * The root closes on the session `close` event with a per-model usage roll-up (token, character,
 * and audio totals for the whole call) from a `ModelUsageCollector`.
 *
 * Returns `undefined` when the Mastra instance has no observability configured, so callers
 * can treat instrumentation as a no-op without branching on config.
 */
export function startVoiceCallObservability(
  options: VoiceCallObservabilityOptions,
): VoiceCallObservability | undefined {
  const span = getOrCreateSpan<SpanType.GENERIC>({
    mastra: options.mastra,
    type: SpanType.GENERIC,
    name: 'voice call',
    requestContext: options.requestContext,
    metadata: {
      agentId: options.agentId,
      roomName: options.roomName,
      ...(options.metadata.threadId ? { threadId: options.metadata.threadId } : {}),
      ...(options.metadata.resourceId ? { resourceId: options.metadata.resourceId } : {}),
    },
  });

  if (!span) return undefined;

  const usage = new metrics.ModelUsageCollector();
  let finalized = false;

  const finalize = (opts?: { error?: unknown }): void => {
    if (finalized) return;
    finalized = true;
    const summary = usage.flatten();
    if (opts?.error) {
      span.error({
        error: opts.error instanceof Error ? opts.error : new Error(String(opts.error)),
        metadata: { usage: summary },
      });
    } else {
      span.end({ output: { usage: summary } });
    }
  };

  return {
    span,
    tracingContext: { currentSpan: span },
    attach(session: voice.AgentSession) {
      session.on(voice.AgentSessionEventTypes.MetricsCollected, (event: { metrics: metrics.AgentMetrics }) => {
        usage.collect(event.metrics);
        const described = describeMetric(event.metrics);
        if (!described) return;
        // Event span: a point-in-time measurement, not a duration. The value is in the name
        // (for the timeline) and the full fields are on output.
        span.createEventSpan({ type: SpanType.GENERIC, name: described.name, output: described.data });
      });
      // The call ends when the session closes — finalize then so the root span and its usage
      // roll-up land promptly. The worker's ctx.addShutdownCallback is a backstop for abnormal
      // termination (the job ending without a clean session close).
      session.on(voice.AgentSessionEventTypes.Close, (event: { error?: unknown }) => {
        finalize({ error: event?.error ?? undefined });
      });
    },
    finalize,
  };
}
