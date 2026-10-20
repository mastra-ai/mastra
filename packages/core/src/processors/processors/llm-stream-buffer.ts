import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';
import { FLUSH_HELD_PARTS_KEY, REPROCESS_PART_KEY } from '../stream-reprocess';
import type { FlushHeldParts } from '../stream-reprocess';

/** Default character threshold before buffered stream text is sent to an LLM-backed check. */
export const DEFAULT_LLM_STREAM_BUFFER_SIZE = 200;

const SENTENCE_END = /[.!?]\s*$/;
const STATE_KEY = '__mastraLLMStreamBuffer';

type TextDeltaPart = ChunkType & { type: 'text-delta' };

interface LLMStreamBufferState {
  text: string;
  id?: string;
  runId?: string;
}

/**
 * Buffers streamed text so an LLM-backed output processor runs one check per
 * sentence (or `bufferSize` characters) instead of one per text-delta.
 *
 * `check` receives the buffered text as a single text-delta and returns the
 * part to emit (possibly redacted) or null to drop it. Buffered text is always
 * flushed before any non-text part, so text never crosses a step or finish
 * boundary.
 *
 * Emitting flushed text and the non-text part that triggered the flush needs
 * the runner to re-drive the second part, which it only does when a writer is
 * present. Without one, every text-delta is checked on its own so no part can
 * be held back past the end of the stream.
 */
export async function processBufferedTextStream({
  part,
  state,
  bufferSize,
  writer,
  check,
}: {
  part: ChunkType;
  state: Record<string, any>;
  bufferSize: number;
  writer?: unknown;
  check: (part: TextDeltaPart) => Promise<ChunkType | null>;
}): Promise<ChunkType | null> {
  if (part.type === 'text-delta' && !(part as TextDeltaPart).payload.text) return part;
  if (!writer) return part.type === 'text-delta' ? check(part as TextDeltaPart) : part;

  const buffer: LLMStreamBufferState = (state[STATE_KEY] ??= { text: '' });
  state[FLUSH_HELD_PARTS_KEY] = (async options => {
    if (options?.discard) {
      buffer.text = '';
      buffer.id = undefined;
      buffer.runId = undefined;
      return [];
    }
    const flushed = await flush(buffer, check);
    return flushed ? [flushed] : [];
  }) satisfies FlushHeldParts;

  if (part.type !== 'text-delta') {
    const flushed = await flush(buffer, check);
    if (!flushed) return part;
    state[REPROCESS_PART_KEY] = part;
    return flushed;
  }

  append(buffer, part as TextDeltaPart);
  if (buffer.text.length >= bufferSize || SENTENCE_END.test(buffer.text)) {
    return flush(buffer, check);
  }
  return null;
}

function append(buffer: LLMStreamBufferState, part: TextDeltaPart) {
  if (!buffer.text) {
    buffer.id = part.payload.id;
    buffer.runId = part.runId;
  }
  buffer.text += part.payload.text;
}

async function flush(
  buffer: LLMStreamBufferState,
  check: (part: TextDeltaPart) => Promise<ChunkType | null>,
): Promise<ChunkType | null> {
  const text = buffer.text;
  const id = buffer.id ?? 'text-0';
  const runId = buffer.runId ?? '';
  buffer.text = '';
  buffer.id = undefined;
  buffer.runId = undefined;
  if (!text) return null;
  if (!text.trim()) return { type: 'text-delta', payload: { text, id }, runId, from: ChunkFrom.AGENT };
  return check({ type: 'text-delta', payload: { text, id }, runId, from: ChunkFrom.AGENT } as TextDeltaPart);
}
