import { PipeableTransformStream } from "../utils/stream/PipeableTransformStream";
import { ObjectStreamAccumulator } from "./ObjectStreamAccumulator";
import { SSEDecoder, SSEEncoder } from "../utils/stream/SSE";
import { ObjectStreamChunk, ObjectStreamOperation } from "./types";

export class ObjectStreamEncoder extends PipeableTransformStream<
  ObjectStreamChunk,
  Uint8Array
> {
  constructor() {
    super((readable) =>
      readable
        .pipeThrough(
          (() => {
            class ObjectStreamTransformer
              implements
                Transformer<ObjectStreamChunk, readonly ObjectStreamOperation[]>
            {
              #isFirstChunk = true;

              start() {
                // Nothing needed here since we initialize in the field declaration
              }

              transform(
                chunk: ObjectStreamChunk,
                controller: TransformStreamDefaultController<
                  readonly ObjectStreamOperation[]
                >,
              ) {
                if (
                  this.#isFirstChunk &&
                  chunk.snapshot &&
                  Object.keys(chunk.snapshot).length > 0
                ) {
                  // For the first chunk, if there's an initial state that's not empty,
                  // prepend a set operation for the initial state
                  controller.enqueue([
                    { type: "set", path: [], value: chunk.snapshot },
                    ...chunk.operations,
                  ]);
                } else {
                  controller.enqueue(chunk.operations);
                }
                this.#isFirstChunk = false;
              }
            }
            return new TransformStream(new ObjectStreamTransformer());
          })(),
        )
        .pipeThrough(new SSEEncoder()),
    );
  }
}

export class ObjectStreamDecoder extends PipeableTransformStream<
  Uint8Array<ArrayBuffer>,
  ObjectStreamChunk
> {
  constructor() {
    const accumulator = new ObjectStreamAccumulator();
    super((readable) =>
      readable
        .pipeThrough(new SSEDecoder<readonly ObjectStreamOperation[]>())
        .pipeThrough(
          new TransformStream<
            readonly ObjectStreamOperation[],
            ObjectStreamChunk
          >({
            transform(operations, controller) {
              accumulator.append(operations);
              controller.enqueue({
                snapshot: accumulator.state,
                operations,
              });
            },
          }),
        ),
    );
  }
}

export class ObjectStreamResponse extends Response {
  constructor(body: ReadableStream<ObjectStreamChunk>) {
    super(body.pipeThrough(new ObjectStreamEncoder()), {
      headers: new Headers({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Assistant-Stream-Format": "object-stream/v0",
      }),
    });
  }
}

export const fromObjectStreamResponse = (
  response: Response,
): ReadableStream<ObjectStreamChunk> => {
  if (!response.ok)
    throw new Error(`Response failed, status ${response.status}`);
  if (!response.body) throw new Error("Response body is null");
  if (response.headers.get("Content-Type") !== "text/event-stream") {
    throw new Error("Response is not an event stream");
  }
  if (response.headers.get("Assistant-Stream-Format") !== "object-stream/v0") {
    throw new Error("Unsupported Assistant-Stream-Format header");
  }
  return response.body.pipeThrough(new ObjectStreamDecoder());
};
