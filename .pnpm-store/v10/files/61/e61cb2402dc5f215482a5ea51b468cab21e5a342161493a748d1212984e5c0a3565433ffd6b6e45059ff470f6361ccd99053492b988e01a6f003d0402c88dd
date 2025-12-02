// src/core/utils/stream/SSE.ts
import { PipeableTransformStream } from "./PipeableTransformStream.js";
import { LineDecoderStream } from "./LineDecoderStream.js";
var SSEEncoder = class _SSEEncoder extends PipeableTransformStream {
  static headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  headers = _SSEEncoder.headers;
  constructor() {
    super(
      (readable) => readable.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            controller.enqueue(`data: ${JSON.stringify(chunk)}

`);
          }
        })
      ).pipeThrough(new TextEncoderStream())
    );
  }
};
var SSEEventStream = class extends TransformStream {
  constructor() {
    let eventBuffer = {};
    let dataLines = [];
    super({
      start() {
        eventBuffer = {};
        dataLines = [];
      },
      transform(line, controller) {
        if (line.startsWith(":")) return;
        if (line === "") {
          if (dataLines.length > 0) {
            controller.enqueue({
              event: eventBuffer.event || "message",
              data: dataLines.join("\n"),
              id: eventBuffer.id,
              retry: eventBuffer.retry
            });
          }
          eventBuffer = {};
          dataLines = [];
          return;
        }
        const [field, ...rest] = line.split(":");
        const value = rest.join(":").trimStart();
        switch (field) {
          case "event":
            eventBuffer.event = value;
            break;
          case "data":
            dataLines.push(value);
            break;
          case "id":
            eventBuffer.id = value;
            break;
          case "retry":
            eventBuffer.retry = Number(value);
            break;
        }
      },
      flush(controller) {
        if (dataLines.length > 0) {
          controller.enqueue({
            event: eventBuffer.event || "message",
            data: dataLines.join("\n"),
            id: eventBuffer.id,
            retry: eventBuffer.retry
          });
        }
      }
    });
  }
};
var SSEDecoder = class extends PipeableTransformStream {
  constructor() {
    super(
      (readable) => readable.pipeThrough(new TextDecoderStream()).pipeThrough(new LineDecoderStream()).pipeThrough(new SSEEventStream()).pipeThrough(
        new TransformStream({
          transform(event, controller) {
            switch (event.event) {
              case "message":
                controller.enqueue(JSON.parse(event.data));
                break;
              default:
                throw new Error(`Unknown SSE event type: ${event.event}`);
            }
          }
        })
      )
    );
  }
};
export {
  SSEDecoder,
  SSEEncoder
};
//# sourceMappingURL=SSE.js.map