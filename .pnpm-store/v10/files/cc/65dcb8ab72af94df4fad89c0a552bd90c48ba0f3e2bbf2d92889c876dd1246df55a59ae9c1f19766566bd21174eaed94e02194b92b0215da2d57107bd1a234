// src/core/utils/stream/AssistantMetaTransformStream.ts
var AssistantMetaTransformStream = class extends TransformStream {
  constructor() {
    const parts = [];
    super({
      transform(chunk, controller) {
        if (chunk.type === "part-start") {
          if (chunk.path.length !== 0) {
            controller.error(new Error("Nested parts are not supported"));
            return;
          }
          parts.push(chunk.part);
          controller.enqueue(chunk);
          return;
        }
        if (chunk.type === "text-delta" || chunk.type === "result" || chunk.type === "part-finish" || chunk.type === "tool-call-args-text-finish") {
          if (chunk.path.length !== 1) {
            controller.error(
              new Error(`${chunk.type} chunks must have a path of length 1`)
            );
            return;
          }
          const idx = chunk.path[0];
          if (idx < 0 || idx >= parts.length) {
            controller.error(new Error(`Invalid path index: ${idx}`));
            return;
          }
          const part = parts[idx];
          controller.enqueue({
            ...chunk,
            meta: part
            // TODO
          });
          return;
        }
        controller.enqueue(chunk);
      }
    });
  }
};
export {
  AssistantMetaTransformStream
};
//# sourceMappingURL=AssistantMetaTransformStream.js.map