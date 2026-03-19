/**
 * Helper functions for evented workflow execution.
 */

import { TripWire } from '../../agent/trip-wire';

/**
 * Interface for tripwire chunks in the stream.
 * These chunks are emitted when a processor triggers a tripwire.
 */
export interface TripwireChunk {
  type: 'tripwire';
  payload: {
    reason: string;
    retry?: boolean;
    metadata?: unknown;
    processorId?: string;
  };
}

/**
 * Type guard to check if a chunk is a tripwire chunk.
 * @param chunk - The chunk to check
 * @returns True if the chunk is a TripwireChunk
 */
export function isTripwireChunk(chunk: unknown): chunk is TripwireChunk {
  return (
    chunk !== null && typeof chunk === 'object' && 'type' in chunk && chunk.type === 'tripwire' && 'payload' in chunk
  );
}

/**
 * Creates a TripWire error from a tripwire chunk.
 * @param chunk - The tripwire chunk from the stream
 * @returns A TripWire error instance
 */
export function createTripWireFromChunk(chunk: TripwireChunk): TripWire {
  const { payload } = chunk;
  return new TripWire(
    payload.reason || 'Agent tripwire triggered',
    {
      retry: payload.retry,
      metadata: payload.metadata,
    },
    payload.processorId,
  );
}

/**
 * Extracts text delta from a stream chunk, handling V1 vs V2 differences.
 *
 * V1 (AI SDK v4): Uses `chunk.textDelta` for raw text
 * V2 (AI SDK v5): Uses `chunk.payload.text` for normalized text
 *
 * @param chunk - The stream chunk
 * @param isV2Model - Whether this is a V2 model (uses normalized payload)
 * @returns The text delta string, or undefined if not a text-delta chunk
 */
export function getTextDeltaFromChunk(
  chunk: { type: string; textDelta?: string; payload?: { text?: string } },
  isV2Model: boolean,
): string | undefined {
  if (chunk.type !== 'text-delta') {
    return undefined;
  }
  return isV2Model ? chunk.payload?.text : chunk.textDelta;
}

/**
 * Parameters for resolving the current workflow state.
 */
export interface ResolveStateParams {
  /** State from a step result (highest priority). Uses `any` to accommodate various StepResult types. */
  stepResult?: unknown;
  /** State from all step results */
  stepResults?: { __state?: Record<string, unknown> };
  /** State passed directly */
  state?: Record<string, unknown>;
}

/**
 * Resolves the current workflow state from multiple potential sources.
 * Priority order: stepResult.__state > stepResults.__state > state > empty object
 *
 * @param params - The state sources to check
 * @returns The resolved state object
 */
export function resolveCurrentState(params: ResolveStateParams): Record<string, unknown> {
  const { stepResult, stepResults, state } = params;
  return (stepResult as any)?.__state ?? stepResults?.__state ?? state ?? {};
}
