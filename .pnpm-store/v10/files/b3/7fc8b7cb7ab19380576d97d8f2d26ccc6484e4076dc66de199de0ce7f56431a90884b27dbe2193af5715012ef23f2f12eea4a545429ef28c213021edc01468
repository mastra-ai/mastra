import { AssistantStreamChunk } from "../../AssistantStreamChunk";
import {
  AssistantStreamController,
  createAssistantStreamController,
} from "../../modules/assistant-stream";

type AssistantTransformerFlushCallback = (
  controller: AssistantStreamController,
) => void | PromiseLike<void>;

type AssistantTransformerStartCallback = (
  controller: AssistantStreamController,
) => void | PromiseLike<void>;

type AssistantTransformerTransformCallback<I> = (
  chunk: I,
  controller: AssistantStreamController,
) => void | PromiseLike<void>;

type AssistantTransformer<I> = {
  flush?: AssistantTransformerFlushCallback;
  start?: AssistantTransformerStartCallback;
  transform?: AssistantTransformerTransformCallback<I>;
};

export class AssistantTransformStream<I> extends TransformStream<
  I,
  AssistantStreamChunk
> {
  constructor(
    transformer: AssistantTransformer<I>,
    writableStrategy?: QueuingStrategy<I>,
    readableStrategy?: QueuingStrategy<AssistantStreamChunk>,
  ) {
    const [stream, runController] = createAssistantStreamController();

    let runPipeTask: Promise<void>;
    super(
      {
        start(controller) {
          runPipeTask = stream
            .pipeTo(
              new WritableStream({
                write(chunk) {
                  controller.enqueue(chunk);
                },
                abort(reason?: any) {
                  controller.error(reason);
                },
                close() {
                  controller.terminate();
                },
              }),
            )
            .catch((error) => {
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
        },
      },
      writableStrategy,
      readableStrategy,
    );
  }
}
