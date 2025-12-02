import { AssistantStreamChunk, PartInit } from "../../AssistantStreamChunk";
/**
 * For chunk types that are associated with a part,
 * we require a non‑nullable meta field.
 */
export type AssistantMetaStreamChunk = (AssistantStreamChunk & {
    type: "text-delta" | "part-finish";
    meta: PartInit;
}) | (AssistantStreamChunk & {
    type: "result" | "tool-call-args-text-finish";
    meta: PartInit & {
        type: "tool-call";
    };
}) | (AssistantStreamChunk & {
    type: Exclude<AssistantStreamChunk["type"], "text-delta" | "result" | "tool-call-args-text-finish" | "part-finish">;
});
export declare class AssistantMetaTransformStream extends TransformStream<AssistantStreamChunk, AssistantMetaStreamChunk> {
    constructor();
}
//# sourceMappingURL=AssistantMetaTransformStream.d.ts.map