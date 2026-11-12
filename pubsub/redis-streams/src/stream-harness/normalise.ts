import type { Frame } from './types';

/** A chunk as a reader received it, before reduction. */
export interface RawFrame {
  type: string;
  payload?: any;
}

const DROPPED = new Set(['raw', 'response-metadata']);
/** Frames whose bodies are split arbitrarily; consecutive ones collapse into one frame. */
const JOINED = new Set(['text-delta', 'reasoning-delta']);

/**
 * A chunk from `fullStream` / `observe()`. Most chunks carry their content in
 * `payload`; `object` and `object-result` carry it on the chunk itself.
 */
export function fromChunk(chunk: any): RawFrame {
  return { type: String(chunk?.type), payload: chunk?.payload ?? chunk };
}

/**
 * An event read from the run topic. `chunk` events carry a stream chunk;
 * every other event type (`step-finish`, `finish`, `error`, ...) is reported
 * under its own name with its data as the payload.
 */
export function fromTopicEvent(event: any): RawFrame {
  if (event?.type === 'chunk') return fromChunk(event.data);
  return { type: String(event?.type), payload: event?.data };
}

function stable(value: unknown): string {
  if (value === undefined) return 'undefined';
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v as object)
            .sort()
            .map(k => [k, (v as any)[k]]),
        )
      : v,
  );
}

/** What a reader can tell about an error value without depending on ids or stack text. */
export function errorShape(error: unknown): string {
  const isError = error instanceof Error;
  const keys = error && typeof error === 'object' ? Object.keys(error).sort() : [];
  return `isError=${isError} keys=${keys.join('|') || '-'} type=${error === null ? 'null' : typeof error}`;
}

function shapeOf(frame: RawFrame): string | undefined {
  const p = frame.payload;
  switch (frame.type) {
    case 'error':
    case 'tool-error':
      return errorShape(p?.error);
    case 'object':
    case 'object-result':
      return stable(p?.object);
    case 'tool-result':
      return stable(p?.result);
    case 'tripwire':
      return String(p?.reason ?? p?.tripwireReason ?? '');
    default:
      return undefined;
  }
}

/**
 * Reduces raw frames to what every reader must agree on: frame types in
 * order, joined text, structured objects, tool results and error shapes. Ids,
 * timestamps, usage and envelope keys are not compared.
 */
export function normalise(raw: RawFrame[]): Frame[] {
  const frames: Frame[] = [];
  for (const frame of raw) {
    if (DROPPED.has(frame.type)) continue;
    const last = frames[frames.length - 1];
    if (JOINED.has(frame.type)) {
      const text = String(frame.payload?.text ?? '');
      if (last?.type === frame.type) last.shape = `${last.shape ?? ''}${text}`;
      else frames.push({ type: frame.type, shape: text });
      continue;
    }
    const shape = shapeOf(frame);
    // Partial objects stream at arbitrary granularity; keep the last one of a run.
    if (frame.type === 'object' && last?.type === 'object') {
      last.shape = shape;
      continue;
    }
    frames.push(shape === undefined ? { type: frame.type } : { type: frame.type, shape });
  }
  return frames;
}
