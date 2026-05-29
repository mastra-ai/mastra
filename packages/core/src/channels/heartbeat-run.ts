/**
 * Heartbeat run lifecycle markers.
 *
 * Owns:
 *   - The `data-heartbeat-run-*` chunk type definitions
 *   - A type-guard for narrowing arbitrary agent chunks to heartbeat-run chunks
 *
 * Emitted by the heartbeat broadcast processor (one per fire) as transient
 * stream chunks so live subscribers can recognize heartbeat-driven runs in
 * flight — for typing status, banners, or any UI affordance — without
 * polluting persisted thread history.
 *
 * Persisted history carries its own marker via `signal.providerOptions.mastra.heartbeat`
 * on the heartbeat-driven signal message; renderers that load from storage
 * should key off that instead of these transient chunks.
 */
import type { HeartbeatBroadcastMode } from '../agent/heartbeat/broadcast-processor';
import type { AgentChunkType } from '../stream/types';

/**
 * Emitted once per heartbeat fire when the broadcast processor initializes,
 * skipped entirely in `'never'` mode. UIs can use this to set a "checking in…"
 * typing indicator or render a transient banner for the duration of the run.
 */
export interface DataHeartbeatRunStartPart {
  type: 'data-heartbeat-run-start';
  data: {
    /** Stable schedule row id (e.g. `hb_<agentId>_<threadId>`). */
    scheduleId: string;
    /** Broadcast policy in effect for this run. */
    broadcast: HeartbeatBroadcastMode;
    /** Thread the heartbeat run is operating against, if any. Threadless heartbeats omit this. */
    threadId?: string;
    /** When the broadcast processor began observing the run. */
    startedAt: string;
  };
  transient?: boolean;
}

/**
 * Emitted at the end of a heartbeat-driven run (on `finish`, `error`, or
 * `abort`). Lets UIs clear any transient state set on
 * {@link DataHeartbeatRunStartPart}.
 */
export interface DataHeartbeatRunFinishPart {
  type: 'data-heartbeat-run-finish';
  data: {
    scheduleId: string;
    broadcast: HeartbeatBroadcastMode;
    threadId?: string;
    /** When the run terminated. */
    finishedAt: string;
    /** Terminal status as seen by the broadcast processor. */
    status: 'finished' | 'error' | 'aborted';
  };
  transient?: boolean;
}

/**
 * Union of all heartbeat-run chunks.
 */
export type HeartbeatRunChunk = DataHeartbeatRunStartPart | DataHeartbeatRunFinishPart;

/**
 * Type-guard: returns `chunk` narrowed to {@link HeartbeatRunChunk} when its
 * `type` matches one of the heartbeat-run variants, otherwise `null`.
 */
export function asHeartbeatRunChunk(chunk: AgentChunkType<any>): HeartbeatRunChunk | null {
  const t = (chunk as { type?: unknown }).type;
  if (t === 'data-heartbeat-run-start' || t === 'data-heartbeat-run-finish') {
    return chunk as unknown as HeartbeatRunChunk;
  }
  return null;
}
