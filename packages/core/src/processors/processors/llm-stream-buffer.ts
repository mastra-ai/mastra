import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';
import { REPROCESS_PART_KEY } from '../stream-reprocess';

/** Default character threshold before buffered stream text is sent to an LLM-backed check. */
export const DEFAULT_LLM_STREAM_BUFFER_SIZE = 200;

const SENTENCE_END = /[.!?]\s*$/;
const STATE_KEY = '__mastraLLMStreamBuffer';

type TextDeltaPart = ChunkType & { type: 'text-delta' };

interface LLMStreamBufferState {
  text: string;
  id?: string;
  runId?: string;
  pending: ChunkType[];
}

/**
 * Buffers streamed text so an LLM-backed output processor runs one check per
 * sentence (or `bufferSize` characters) instead of one per text-delta.
 *
 * `check` receives the buffered text as a single text-delta and returns the
 * part to emit (possibly redacted) or null to drop it. Buffered text is always
 * flushed before any non-text part, so text never crosses a step or finish
 * boundary.
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
  const buffer: LLMStreamBufferState = (state[STATE_KEY] ??= { text: '', pending: [] });

  // Without a writer the runner cannot re-drive a second part, so a non-text
  // part that triggered a flush is emitted on the next call instead.
  if (buffer.pending.length > 0) {
    const pending = buffer.pending.shift()!;
    if (part.type === 'text-delta') append(buffer, part as TextDeltaPart);
    else buffer.pending.push(part);
    return pending;
  }

  if (part.type !== 'text-delta') {
    const flushed = await flush(buffer, check);
    if (!flushed) return part;
    if (writer) state[REPROCESS_PART_KEY] = part;
    else buffer.pending.push(part);
    return flushed;
  }

  if (!(part as TextDeltaPart).payload.text) return part;

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
