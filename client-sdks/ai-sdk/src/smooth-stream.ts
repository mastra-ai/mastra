import { smoothStream as createSmoothStream } from '@mastra/core/stream';
import type {
  ChunkType,
  MastraStreamTransform,
  MastraStreamTransformOptions,
  SmoothStreamOptions,
} from '@mastra/core/stream';

/**
 * Creates a fresh transform for a Mastra agent stream.
 *
 * Transform factories are reusable across requests, unlike `TransformStream`
 * instances, which can only be consumed once.
 */
export type { MastraStreamTransform, MastraStreamTransformOptions };

/**
 * Creates an experimental stream transform that emits text and reasoning in
 * consistent, delayed chunks.
 *
 * @experimental This API may change in a future release.
 */
export function smoothStream<OUTPUT = undefined>(options?: SmoothStreamOptions): MastraStreamTransform<OUTPUT> {
  return () => createSmoothStream<OUTPUT>(options);
}

export function applyMastraStreamTransforms<OUTPUT>(
  stream: ReadableStream<ChunkType<OUTPUT>>,
  transforms?: MastraStreamTransformOptions<OUTPUT>,
): ReadableStream<ChunkType<OUTPUT>> {
  if (!transforms) {
    return stream;
  }

  const transformList = Array.isArray(transforms) ? transforms : [transforms];
  return transformList.reduce((current, transform) => current.pipeThrough(transform()), stream);
}
