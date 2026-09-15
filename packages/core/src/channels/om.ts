/**
 * Observational Memory (OM) integration for channel rendering.
 *
 * Owns:
 *   - The `data-om-*` chunk type definitions
 *   - A type-guard for narrowing arbitrary agent chunks to OM chunks
 *   - A renderer that converts an OM chunk into a chat-SDK `task_update`
 *     stream chunk (with title + details + compression-ratio math)
 *
 * Drivers should never reach into `om.data.tokensBuffered` etc. directly —
 * just call {@link renderOmTaskUpdate} and push the result into a streaming
 * session.
 */
import type { StreamChunk } from 'chat';

import type { AgentChunkType } from '../stream/types';

// ---------------------------------------------------------------------------
// Chunk types
// ---------------------------------------------------------------------------

export type OmOperationType = 'observation' | 'reflection';

/**
 * Start marker inserted when async buffering begins.
 * Buffering runs in the background to pre-compute observations before the main threshold.
 */
export interface DataOmBufferingStartPart {
  type: 'data-om-buffering-start';
  data: {
    /** Unique ID for this buffering cycle - shared between start/end/failed markers */
    cycleId: string;

    /** Type of operation being buffered: 'observation' or 'reflection' */
    operationType: OmOperationType;

    /** When buffering started */
    startedAt: string;

    /** Tokens being buffered in this cycle */
    tokensToBuffer: number;

    /** The OM record ID this buffering belongs to */
    recordId: string;

    /** This thread's ID */
    threadId: string;

    /** All thread IDs being buffered (for resource-scoped) */
    threadIds: string[];

    /** Snapshot of config at buffering time */
    config?: unknown;
  };
}

/**
 * End marker inserted when async buffering completes successfully.
 * The buffered content is stored but not yet activated (visible to the main context).
 */
export interface DataOmBufferingEndPart {
  type: 'data-om-buffering-end';
  data: {
    /** Unique ID for this buffering cycle - shared between start/end/failed markers */
    cycleId: string;

    /** Type of operation that was buffered: 'observation' or 'reflection' */
    operationType: OmOperationType;

    /** When buffering completed */
    completedAt: string;

    /** Duration in milliseconds */
    durationMs: number;

    /** Total tokens that were buffered */
    tokensBuffered: number;

    /** Resulting observation/reflection tokens after compression */
    bufferedTokens: number;

    /** The OM record ID */
    recordId: string;

    /** This thread's ID */
    threadId: string;

    /** The buffered observations/reflection content (for UI expansion) */
    observations?: string;
  };
}

/**
 * Failed marker inserted when async buffering fails.
 * The system will fall back to synchronous processing at threshold.
 */
export interface DataOmBufferingFailedPart {
  type: 'data-om-buffering-failed';
  data: {
    /** Unique ID for this buffering cycle - shared between start/end/failed markers */
    cycleId: string;

    /** Type of operation that failed: 'observation' or 'reflection' */
    operationType: OmOperationType;

    /** When buffering failed */
    failedAt: string;

    /** Duration until failure in milliseconds */
    durationMs: number;

    /** Tokens that were attempted to buffer */
    tokensAttempted: number;

    /** Error message */
    error: string;

    /** The OM record ID */
    recordId: string;

    /** This thread's ID */
    threadId: string;

    /** The buffered observations/reflection content (for UI expansion) */
    observations?: string;
  };
}

/**
 * Union of all buffering marker types.
 */
export type DataOmBufferingPart = DataOmBufferingStartPart | DataOmBufferingEndPart | DataOmBufferingFailedPart;

/**
 * Marker inserted when buffered observations are activated (moved to active context).
 * This is an instant operation that happens when the main threshold is reached.
 */
export interface DataOmActivationPart {
  type: 'data-om-activation';
  data: {
    /** Unique ID for this activation event */
    cycleId: string;

    /** Type of operation: 'observation' or 'reflection' */
    operationType: OmOperationType;

    /** When activation occurred */
    activatedAt: string;

    /** Number of buffered chunks that were activated */
    chunksActivated: number;

    /** Total tokens from messages that were activated */
    tokensActivated: number;

    /** Resulting observation tokens after activation */
    observationTokens: number;

    /** Number of messages that were observed via activation */
    messagesActivated: number;

    /** The OM record ID */
    recordId: string;

    /** This thread's ID */
    threadId: string;

    /** Current reflection generation count */
    generationCount: number;

    /** Snapshot of config at activation time */
    config?: unknown;

    /** The actual observations from activated chunks (for UI display) */
    observations?: string;

    /** Whether activation was triggered by threshold crossing, activateAfterIdle expiry, or a model/provider change */
    triggeredBy?: 'threshold' | 'ttl' | 'provider_change';

    /** Unix-ms timestamp of the last assistant message part used for TTL checks */
    lastActivityAt?: number;

    /** How long activateAfterIdle had been exceeded when activation fired */
    ttlExpiredMs?: number;

    /** Previous assistant model identifier that triggered activation, e.g. openai/gpt-4o */
    previousModel?: string;

    /** Current actor model identifier that triggered activation, e.g. anthropic/claude-3-7-sonnet */
    currentModel?: string;
  };
}

/**
 * Union of all OM data parts the channels code knows how to render. The
 * `data-om-status` part (window usage snapshot for polling UIs) lives in
 * `@mastra/memory` and is intentionally absent — channels don't render it.
 */
export type OmChunk =
  | DataOmBufferingStartPart
  | DataOmBufferingEndPart
  | DataOmBufferingFailedPart
  | DataOmActivationPart;

// ---------------------------------------------------------------------------
// Guards + formatting + rendering
// ---------------------------------------------------------------------------

/**
 * Type-guard: returns `chunk` narrowed to {@link OmChunk} when its `type`
 * matches one of the renderable `data-om-*` variants, otherwise `null`.
 */
export function asOmChunk(chunk: AgentChunkType<any>): OmChunk | null {
  const t = (chunk as { type?: unknown }).type;
  if (
    t === 'data-om-buffering-start' ||
    t === 'data-om-buffering-end' ||
    t === 'data-om-buffering-failed' ||
    t === 'data-om-activation'
  ) {
    return chunk as unknown as OmChunk;
  }
  return null;
}

/**
 * Token formatter: `8200 → "8.2k"`, `12000 → "12k"`. Matches
 * `mastracode/tui/src/tui/components/om-marker.ts` so OM lines render the same
 * way across surfaces.
 */
export function formatTokens(tokens: number): string {
  if (tokens === 0) return '0';
  const k = tokens / 1000;
  return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
}

/**
 * Render an OM chunk as a chat-SDK `task_update` chunk. Stable task IDs
 * (`om-buffer:<cycleId>` / `om-activation:<cycleId>`) ensure start/end of
 * the same cycle replace each other in the plan widget instead of stacking.
 */
export function renderOmTaskUpdate(om: OmChunk): StreamChunk {
  const { cycleId, operationType } = om.data;
  const isReflection = operationType === 'reflection';

  if (om.type === 'data-om-buffering-start') {
    return {
      type: 'task_update',
      id: `om-buffer:${cycleId}`,
      title: isReflection ? 'Reflecting on observations…' : 'Saving to memory…',
      status: 'in_progress',
    };
  }

  if (om.type === 'data-om-buffering-end') {
    // For observations `bufferedTokens` is a cumulative total — approximate
    // this cycle's output from the observations string (~4 chars/token).
    // For reflections `bufferedTokens` is the actual output token count.
    const outputTokens =
      operationType === 'observation' && om.data.observations
        ? Math.round(om.data.observations.length / 4)
        : om.data.bufferedTokens;
    const ratio =
      om.data.tokensBuffered > 0 && outputTokens > 0 ? ` (${Math.round(om.data.tokensBuffered / outputTokens)}x)` : '';
    return {
      type: 'task_update',
      id: `om-buffer:${cycleId}`,
      title: isReflection ? `Reflected on observations${ratio}` : `Saved to memory${ratio}`,
      status: 'complete',
      details:
        om.data.tokensBuffered > 0
          ? `${formatTokens(om.data.tokensBuffered)} → ${formatTokens(outputTokens)} tokens`
          : undefined,
    };
  }

  if (om.type === 'data-om-buffering-failed') {
    return {
      type: 'task_update',
      id: `om-buffer:${cycleId}`,
      title: isReflection ? 'Reflection failed' : 'Failed to save to memory',
      status: 'error',
      details: om.data.error,
    };
  }

  // data-om-activation
  if (operationType === 'reflection') {
    // Reflection compresses observations in place — tokensActivated = obs
    // tokens before, observationTokens = obs tokens after.
    const delta = om.data.tokensActivated - om.data.observationTokens;
    const deltaStr = delta > 0 ? ` (-${formatTokens(delta)})` : delta < 0 ? ` (+${formatTokens(-delta)})` : '';
    return {
      type: 'task_update',
      id: `om-activation:${cycleId}`,
      title: `Activated reflection${deltaStr}`,
      status: 'complete',
      details: `${formatTokens(om.data.tokensActivated)} → ${formatTokens(om.data.observationTokens)} memory tokens`,
    };
  }

  return {
    type: 'task_update',
    id: `om-activation:${cycleId}`,
    title: 'Recalled memory',
    status: 'complete',
    details: `-${formatTokens(om.data.tokensActivated)} message tokens, +${formatTokens(om.data.observationTokens)} memory tokens`,
  };
}
