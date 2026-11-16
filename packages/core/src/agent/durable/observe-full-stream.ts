import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { ChunkType } from '../../stream/types';

/**
 * Minimal shape this helper needs: an output whose `fullStream` is supplied by a
 * prototype getter. `MastraModelOutput` (and its destructurable proxy) satisfies
 * this structurally. `fullStream` is typed as `node:stream/web`'s
 * `ReadableStream` — matching `MastraModelOutput` — rather than the DOM global,
 * which differs nominally on the read-result types.
 */
type FullStreamOutput<TOutput> = { fullStream: WebReadableStream<ChunkType<TOutput>> };

/**
 * Make a single observer's `fullStream` detach its subscription when the
 * consumer stops reading it.
 *
 * An `observe()` output belongs to one observer alone, so a consumer that stops
 * reading `fullStream` (break/return/throw out of `for await`, or an explicit
 * cancel) should release the pubsub subscription. `MastraModelOutput` fans out
 * to several readers and only drops the cancelled reader's listeners, so the
 * cancel never reaches the subscription — pass it through here by defining an
 * own `fullStream` getter on `output` that wraps the prototype getter's stream.
 *
 * The wrapper is deliberately lazy (`get(this)`) and calls the inherited getter
 * with `this` so it runs against the real instance: the destructurable proxy
 * that fronts an observer output reads getters with its target as receiver, and
 * the proxy itself cannot reach the getter's private fields.
 */
export function detachFullStreamOnEnd<TOutput>(output: FullStreamOutput<TOutput>, detach: () => void): void {
  const baseFullStream = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(output), 'fullStream')!.get!;
  Object.defineProperty(output, 'fullStream', {
    configurable: true,
    get(this: FullStreamOutput<TOutput>) {
      const reader = (baseFullStream.call(this) as ReadableStream<ChunkType<TOutput>>).getReader();
      return new ReadableStream<ChunkType<TOutput>>({
        async pull(controller) {
          let result: ReadableStreamReadResult<ChunkType<TOutput>>;
          try {
            result = await reader.read();
          } catch (error) {
            detach();
            throw error;
          }
          if (result.done) {
            detach();
            controller.close();
          } else {
            controller.enqueue(result.value);
          }
        },
        cancel(reason) {
          detach();
          return reader.cancel(reason);
        },
      });
    },
  });
}
