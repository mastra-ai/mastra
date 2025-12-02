// src/core/utils/stream/AssistantTransformStream.ts
import {
  createAssistantStreamController
} from "../../modules/assistant-stream.js";
var AssistantTransformStream = class extends TransformStream {
  constructor(transformer, writableStrategy, readableStrategy) {
    const [stream, runController] = createAssistantStreamController();
    let runPipeTask;
    super(
      {
        start(controller) {
          runPipeTask = stream.pipeTo(
            new WritableStream({
              write(chunk) {
                controller.enqueue(chunk);
              },
              abort(reason) {
                controller.error(reason);
              },
              close() {
                controller.terminate();
              }
            })
          ).catch((error) => {
            controller.error(error);
          });
          return transformer.start?.(runController);
        },
        transform(chunk) {
          return transformer.transform?.(chunk, runController);
        },
        async flush() {
          await transformer.flush?.(runController);
          runController.close();
          await runPipeTask;
        }
      },
      writableStrategy,
      readableStrategy
    );
  }
};
export {
  AssistantTransformStream
};
//# sourceMappingURL=AssistantTransformStream.js.map