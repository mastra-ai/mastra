import { AssistantStreamEncoder } from "../AssistantStream";
import { AssistantStreamChunk } from "../AssistantStreamChunk";
import { AssistantTransformStream } from "../utils/stream/AssistantTransformStream";
import { PipeableTransformStream } from "../utils/stream/PipeableTransformStream";

export class PlainTextEncoder
  extends PipeableTransformStream<AssistantStreamChunk, Uint8Array<ArrayBuffer>>
  implements AssistantStreamEncoder
{
  headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "x-vercel-ai-data-stream": "v1",
  });

  constructor() {
    super((readable) => {
      const transform = new TransformStream<AssistantStreamChunk, string>({
        transform(chunk, controller) {
          const type = chunk.type;
          switch (type) {
            case "text-delta":
              controller.enqueue(chunk.textDelta);
              break;

            case "part-start":
            case "part-finish":
            case "step-start":
            case "step-finish":
            case "message-finish":
            case "error":
              break;

            default:
              const unsupportedType:
                | "tool-call-args-text-finish"
                | "data"
                | "annotations"
                | "tool-call-begin"
                | "tool-call-delta"
                | "result"
                | "update-state" = type;
              throw new Error(`unsupported chunk type: ${unsupportedType}`);
          }
        },
      });

      return readable
        .pipeThrough(transform)
        .pipeThrough(new TextEncoderStream());
    });
  }
}

export class PlainTextDecoder extends PipeableTransformStream<
  Uint8Array<ArrayBuffer>,
  AssistantStreamChunk
> {
  constructor() {
    super((readable) => {
      const transform = new AssistantTransformStream<string>({
        transform(chunk, controller) {
          controller.appendText(chunk);
        },
      });

      return readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(transform);
    });
  }
}
