import { AssistantStreamChunk } from "../../AssistantStreamChunk";
import { AssistantStreamController } from "../../modules/assistant-stream";
type AssistantTransformerFlushCallback = (controller: AssistantStreamController) => void | PromiseLike<void>;
type AssistantTransformerStartCallback = (controller: AssistantStreamController) => void | PromiseLike<void>;
type AssistantTransformerTransformCallback<I> = (chunk: I, controller: AssistantStreamController) => void | PromiseLike<void>;
type AssistantTransformer<I> = {
    flush?: AssistantTransformerFlushCallback;
    start?: AssistantTransformerStartCallback;
    transform?: AssistantTransformerTransformCallback<I>;
};
export declare class AssistantTransformStream<I> extends TransformStream<I, AssistantStreamChunk> {
    constructor(transformer: AssistantTransformer<I>, writableStrategy?: QueuingStrategy<I>, readableStrategy?: QueuingStrategy<AssistantStreamChunk>);
}
export {};
//# sourceMappingURL=AssistantTransformStream.d.ts.map