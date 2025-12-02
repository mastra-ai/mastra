import { AssistantStreamChunk, PartInit } from "../../AssistantStreamChunk";

/**
 * For chunk types that are associated with a part,
 * we require a non‑nullable meta field.
 */
export type AssistantMetaStreamChunk =
  | (AssistantStreamChunk & {
      type: "text-delta" | "part-finish";
      meta: PartInit;
    })
  | (AssistantStreamChunk & {
      type: "result" | "tool-call-args-text-finish";
      meta: PartInit & { type: "tool-call" };
    })
  | (AssistantStreamChunk & {
      type: Exclude<
        AssistantStreamChunk["type"],
        "text-delta" | "result" | "tool-call-args-text-finish" | "part-finish"
      >;
    });
export class AssistantMetaTransformStream extends TransformStream<
  AssistantStreamChunk,
  AssistantMetaStreamChunk
> {
  constructor() {
    // We use an array to record parts as they are introduced.
    const parts: PartInit[] = [];

    super({
      transform(chunk, controller) {
        // For chunks that introduce a new part.
        if (chunk.type === "part-start") {
          if (chunk.path.length !== 0) {
            controller.error(new Error("Nested parts are not supported"));
            return;
          }
          parts.push(chunk.part);
          controller.enqueue(chunk);
          return;
        }

        // For chunks that expect an associated part.
        if (
          chunk.type === "text-delta" ||
          chunk.type === "result" ||
          chunk.type === "part-finish" ||
          chunk.type === "tool-call-args-text-finish"
        ) {
          if (chunk.path.length !== 1) {
            controller.error(
              new Error(`${chunk.type} chunks must have a path of length 1`),
            );
            return;
          }
          const idx = chunk.path[0]!;
          if (idx < 0 || idx >= parts.length) {
            controller.error(new Error(`Invalid path index: ${idx}`));
            return;
          }
          const part = parts[idx]!;

          controller.enqueue({
            ...chunk,
            meta: part as any, // TODO
          });
          return;
        }

        controller.enqueue(chunk);
      },
    });
  }
}
