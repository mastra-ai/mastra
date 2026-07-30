import { TransformStream } from 'node:stream/web';
import type { ChunkType } from './types';

const CHUNKING_PATTERNS = {
  word: /\S+\s+/m,
  line: /\n+/m,
} as const;

const wait = (delayInMs: number) => new Promise<void>(resolve => setTimeout(resolve, delayInMs));

/**
 * Detects the next complete chunk at the start of a buffered string.
 *
 * @experimental This API may change in a future release.
 */
export type SmoothStreamChunkDetector = (buffer: string) => string | null | undefined;

/**
 * Options for {@link smoothStream}.
 *
 * @experimental This API may change in a future release.
 */
export interface SmoothStreamOptions {
  /**
   * Delay between emitted chunks in milliseconds. Set to `null` to emit chunks
   * without a delay.
   *
   * @default 10
   */
  delayInMs?: number | null;

  /**
   * How buffered text and reasoning are divided into chunks.
   *
   * @default 'word'
   */
  chunking?: 'word' | 'line' | RegExp | SmoothStreamChunkDetector | Intl.Segmenter;
}

type SmoothableChunk<OUTPUT> = Extract<ChunkType<OUTPUT>, { type: 'text-delta' | 'reasoning-delta' }>;

function createChunkDetector(chunking: NonNullable<SmoothStreamOptions['chunking']>): SmoothStreamChunkDetector {
  if (typeof chunking === 'object' && 'segment' in chunking && typeof chunking.segment === 'function') {
    return buffer => {
      if (!buffer) {
        return null;
      }

      const firstSegment = chunking.segment(buffer)[Symbol.iterator]().next().value;
      return firstSegment?.segment || null;
    };
  }

  if (typeof chunking === 'function') {
    return buffer => {
      const match = chunking(buffer);

      if (match == null) {
        return null;
      }

      if (!match.length) {
        throw new TypeError('The chunking function must return a non-empty string.');
      }

      if (!buffer.startsWith(match)) {
        throw new TypeError('The chunking function must return a prefix of the buffered text.');
      }

      return match;
    };
  }

  const pattern = typeof chunking === 'string' ? CHUNKING_PATTERNS[chunking] : chunking;

  if (!(pattern instanceof RegExp)) {
    throw new TypeError('chunking must be "word", "line", a RegExp, an Intl.Segmenter, or a chunk detector function.');
  }

  return buffer => {
    pattern.lastIndex = 0;
    const match = pattern.exec(buffer);

    if (!match) {
      return null;
    }

    const detected = buffer.slice(0, match.index) + match[0];
    if (!detected.length) {
      throw new TypeError('The chunking RegExp must match a non-empty string.');
    }

    return detected;
  };
}

/**
 * Creates a transform stream that buffers text and reasoning deltas and emits
 * them in consistent, delayed chunks. Other stream parts pass through without
 * modification after any buffered content has been emitted.
 *
 * @experimental This API may change in a future release.
 */
export function smoothStream<OUTPUT = undefined>({
  delayInMs = 10,
  chunking = 'word',
}: SmoothStreamOptions = {}): TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>> {
  const detectChunk = createChunkDetector(chunking);
  let buffer = '';
  let bufferedChunk: SmoothableChunk<OUTPUT> | undefined;
  let bufferedMetadata: SmoothableChunk<OUTPUT>['metadata'];
  let bufferedProviderMetadata: SmoothableChunk<OUTPUT>['payload']['providerMetadata'];

  const enqueueBufferedText = (controller: TransformStreamDefaultController<ChunkType<OUTPUT>>, text: string) => {
    if (!bufferedChunk || !text) {
      return;
    }

    const { metadata: _metadata, ...chunkWithoutMetadata } = bufferedChunk;
    const { providerMetadata: _providerMetadata, ...payloadWithoutProviderMetadata } = bufferedChunk.payload;

    controller.enqueue({
      ...chunkWithoutMetadata,
      ...(bufferedMetadata !== undefined ? { metadata: bufferedMetadata } : {}),
      payload: {
        ...payloadWithoutProviderMetadata,
        ...(bufferedProviderMetadata !== undefined ? { providerMetadata: bufferedProviderMetadata } : {}),
        text,
      },
    } as ChunkType<OUTPUT>);

    bufferedMetadata = undefined;
    bufferedProviderMetadata = undefined;
  };

  const flushBuffer = (controller: TransformStreamDefaultController<ChunkType<OUTPUT>>) => {
    enqueueBufferedText(controller, buffer);
    buffer = '';
    bufferedChunk = undefined;
    bufferedMetadata = undefined;
    bufferedProviderMetadata = undefined;
  };

  return new TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>>({
    async transform(chunk, controller) {
      if (chunk.type !== 'text-delta' && chunk.type !== 'reasoning-delta') {
        flushBuffer(controller);
        controller.enqueue(chunk);
        return;
      }

      if (bufferedChunk && (chunk.type !== bufferedChunk.type || chunk.payload.id !== bufferedChunk.payload.id)) {
        flushBuffer(controller);
      }

      buffer += chunk.payload.text;
      bufferedChunk = chunk as SmoothableChunk<OUTPUT>;
      bufferedMetadata = chunk.metadata ?? bufferedMetadata;
      bufferedProviderMetadata = chunk.payload.providerMetadata ?? bufferedProviderMetadata;

      let match: string | null | undefined;
      while ((match = detectChunk(buffer)) != null) {
        enqueueBufferedText(controller, match);
        buffer = buffer.slice(match.length);

        if (delayInMs !== null) {
          await wait(delayInMs);
        }
      }
    },
    flush(controller) {
      flushBuffer(controller);
    },
  });
}
