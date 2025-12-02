// src/core/object/ObjectStreamResponse.ts
import { PipeableTransformStream } from "../utils/stream/PipeableTransformStream.js";
import { ObjectStreamAccumulator } from "./ObjectStreamAccumulator.js";
import { SSEDecoder, SSEEncoder } from "../utils/stream/SSE.js";
var ObjectStreamEncoder = class extends PipeableTransformStream {
  constructor() {
    super(
      (readable) => readable.pipeThrough(
        (() => {
          class ObjectStreamTransformer {
            #isFirstChunk = true;
            start() {
            }
            transform(chunk, controller) {
              if (this.#isFirstChunk && chunk.snapshot && Object.keys(chunk.snapshot).length > 0) {
                controller.enqueue([
                  { type: "set", path: [], value: chunk.snapshot },
                  ...chunk.operations
                ]);
              } else {
                controller.enqueue(chunk.operations);
              }
              this.#isFirstChunk = false;
            }
          }
          return new TransformStream(new ObjectStreamTransformer());
        })()
      ).pipeThrough(new SSEEncoder())
    );
  }
};
var ObjectStreamDecoder = class extends PipeableTransformStream {
  constructor() {
    const accumulator = new ObjectStreamAccumulator();
    super(
      (readable) => readable.pipeThrough(new SSEDecoder()).pipeThrough(
        new TransformStream({
          transform(operations, controller) {
            accumulator.append(operations);
            controller.enqueue({
              snapshot: accumulator.state,
              operations
            });
          }
        })
      )
    );
  }
};
var ObjectStreamResponse = class extends Response {
  constructor(body) {
    super(body.pipeThrough(new ObjectStreamEncoder()), {
      headers: new Headers({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Assistant-Stream-Format": "object-stream/v0"
      })
    });
  }
};
var fromObjectStreamResponse = (response) => {
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
export {
  ObjectStreamDecoder,
  ObjectStreamEncoder,
  ObjectStreamResponse,
  fromObjectStreamResponse
};
//# sourceMappingURL=ObjectStreamResponse.js.map