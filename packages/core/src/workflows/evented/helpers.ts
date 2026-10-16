/**
 * Helper functions for evented workflow execution.
 */

import { TripWire } from '../../agent/trip-wire';
import { MASTRA_AUTH_TOKEN_KEY } from '../../request-context';

/**
 * Returns a copy of a serialized request context without the framework-managed
 * bearer token. The token must never be persisted in durable snapshots (it is
 * only valid for the live request), matching DefaultExecutionEngine.serializeRequestContext.
 */
export function withoutAuthToken<T extends Record<string, any> | undefined>(requestContext: T): T {
  if (!requestContext || !(MASTRA_AUTH_TOKEN_KEY in requestContext)) {
    return requestContext;
  }
  const { [MASTRA_AUTH_TOKEN_KEY]: _authToken, ...rest } = requestContext;
  return rest as T;
}

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
 * Extracts the text from a text-delta stream chunk, or undefined for other chunks.
 */
export function getTextDeltaFromChunk(chunk: { type: string; payload?: { text?: string } }): string | undefined {
  return chunk.type === 'text-delta' ? chunk.payload?.text : undefined;
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
