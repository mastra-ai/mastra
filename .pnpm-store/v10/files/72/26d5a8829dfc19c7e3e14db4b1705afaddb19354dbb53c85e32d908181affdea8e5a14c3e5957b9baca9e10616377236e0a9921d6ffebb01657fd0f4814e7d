import { PipeableTransformStream } from "./PipeableTransformStream";
import { LineDecoderStream } from "./LineDecoderStream";

export class SSEEncoder<T> extends PipeableTransformStream<
  T,
  Uint8Array<ArrayBuffer>
> {
  static readonly headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  headers = SSEEncoder.headers;

  constructor() {
    super((readable) =>
      readable
        .pipeThrough(
          new TransformStream<T, string>({
            transform(chunk, controller) {
              controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
            },
          }),
        )
        .pipeThrough(new TextEncoderStream()),
    );
  }
}

type SSEEvent = {
  event: string;
  data: string;
  id?: string | undefined;
  retry?: number | undefined;
};

class SSEEventStream extends TransformStream<string, SSEEvent> {
  constructor() {
    let eventBuffer: Partial<SSEEvent> = {};
    let dataLines: string[] = [];

    super({
      start() {
        eventBuffer = {};
        dataLines = [];
      },
      transform(line, controller) {
        if (line.startsWith(":")) return; // Ignore comments

        if (line === "") {
          if (dataLines.length > 0) {
            controller.enqueue({
              event: eventBuffer.event || "message",
              data: dataLines.join("\n"),
              id: eventBuffer.id,
              retry: eventBuffer.retry,
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
            retry: eventBuffer.retry,
          });
        }
      },
    });
  }
}

export class SSEDecoder<T> extends PipeableTransformStream<
  Uint8Array<ArrayBuffer>,
  T
> {
  constructor() {
    super((readable) =>
      readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new LineDecoderStream())
        .pipeThrough(new SSEEventStream())
        .pipeThrough(
          new TransformStream<SSEEvent, T>({
            transform(event, controller) {
              switch (event.event) {
                case "message":
                  controller.enqueue(JSON.parse(event.data));
                  break;
                default:
                  throw new Error(`Unknown SSE event type: ${event.event}`);
              }
            },
          }),
        ),
    );
  }
}
