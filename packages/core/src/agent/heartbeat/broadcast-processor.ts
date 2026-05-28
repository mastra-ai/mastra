import type { OutputProcessor } from '../../processors';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';

/**
 * Stable id used to recognize this processor in the per-run output stream
 * pipeline. The pipeline injects a `controller` into `state.customState`
 * (see `stream/base/output.ts`) so the processor can enqueue extra chunks
 * on top of its single return value.
 */
export const HEARTBEAT_BROADCAST_PROCESSOR_NAME = '__heartbeat-broadcast__';

/**
 * Per-heartbeat broadcast policy. Controls what subscribers of the agent
 * thread stream see while the heartbeat-driven run is in flight.
 *
 * - `live`         pass every chunk through unchanged (default)
 * - `on-complete`  drop intermediate text chunks; on `finish`, replay the
 *                  full response as a single `text-start` + `text-delta` +
 *                  `text-end` burst before the `finish` chunk
 * - `never`        drop every chunk — the run still happens server-side
 *                  (memory, traces, observational memory, persistence)
 */
export type HeartbeatBroadcastMode = 'live' | 'on-complete' | 'never';

interface HeartbeatBroadcastState {
  initialized: boolean;
  mode: HeartbeatBroadcastMode;
  scheduleId: string;
  bufferedText: string;
  textId: string;
  controller?: { enqueue: (chunk: ChunkType) => void };
}

function readState(state: Record<string, unknown>): HeartbeatBroadcastState {
  return state as unknown as HeartbeatBroadcastState;
}

function buildTextStart(runId: string, textId: string): ChunkType {
  return {
    type: 'text-start',
    runId,
    from: ChunkFrom.AGENT,
    payload: { id: textId },
  };
}

function buildTextDelta(runId: string, textId: string, text: string): ChunkType {
  return {
    type: 'text-delta',
    runId,
    from: ChunkFrom.AGENT,
    payload: { id: textId, text },
  };
}

function buildTextEnd(runId: string, textId: string): ChunkType {
  return {
    type: 'text-end',
    runId,
    from: ChunkFrom.AGENT,
    payload: { id: textId },
  };
}

/**
 * Build the per-run heartbeat broadcast processor.
 *
 * The heartbeat workflow constructs one instance per fire and passes it as
 * the first `outputProcessor` on the run options, so the processor only
 * ever runs against heartbeat-driven runs. Non-heartbeat runs are
 * untouched.
 */
export function createHeartbeatBroadcastProcessor({
  mode,
  scheduleId,
}: {
  mode: HeartbeatBroadcastMode;
  scheduleId: string;
}): OutputProcessor {
  return {
    id: HEARTBEAT_BROADCAST_PROCESSOR_NAME,
    name: 'Heartbeat Broadcast',
    processDataParts: true,
    async processOutputStream({ part, state }) {
      const s = readState(state);
      if (!s.initialized) {
        s.initialized = true;
        s.mode = mode;
        s.scheduleId = scheduleId;
        s.bufferedText = '';
        s.textId = `hb-broadcast-${scheduleId}`;
      }

      if (s.mode === 'live') {
        return part;
      }

      if (s.mode === 'never') {
        // error/abort still go through so subscribers see terminal state
        if (part.type === 'error' || part.type === 'abort') {
          return part;
        }
        return null;
      }

      // 'on-complete'
      switch (part.type) {
        case 'text-delta': {
          const payload = part.payload as { text?: string };
          if (typeof payload?.text === 'string') {
            s.bufferedText += payload.text;
          }
          return null;
        }
        case 'text-start':
        case 'text-end':
        case 'step-start':
        case 'step-finish':
        case 'reasoning-start':
        case 'reasoning-delta':
        case 'reasoning-end':
        case 'reasoning-signature':
        case 'redacted-reasoning':
        case 'source':
        case 'file':
        case 'tool-call':
        case 'tool-result':
        case 'tool-call-input-streaming-start':
        case 'tool-call-delta':
        case 'tool-call-input-streaming-end':
        case 'response-metadata':
          return null;
        case 'error':
        case 'abort':
          // Flush any buffered text before the terminal chunk
          if (s.bufferedText.length > 0 && s.controller) {
            s.controller.enqueue(buildTextStart(part.runId, s.textId));
            s.controller.enqueue(buildTextDelta(part.runId, s.textId, s.bufferedText));
            s.controller.enqueue(buildTextEnd(part.runId, s.textId));
            s.bufferedText = '';
          }
          return part;
        case 'finish':
          if (s.bufferedText.length > 0 && s.controller) {
            s.controller.enqueue(buildTextStart(part.runId, s.textId));
            s.controller.enqueue(buildTextDelta(part.runId, s.textId, s.bufferedText));
            s.controller.enqueue(buildTextEnd(part.runId, s.textId));
            s.bufferedText = '';
          }
          return part;
        default:
          // data-* chunks and anything else: drop in on-complete
          if (typeof part.type === 'string' && part.type.startsWith('data-')) {
            return null;
          }
          // start, etc. — pass through; the run lifecycle markers are useful
          return part;
      }
    },
  };
}
