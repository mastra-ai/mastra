// src/core/tool/ToolExecutionStream.ts
import sjson from "secure-json-parse";
import {
  AssistantMetaTransformStream
} from "../utils/stream/AssistantMetaTransformStream.js";
import { PipeableTransformStream } from "../utils/stream/PipeableTransformStream.js";
import { ToolResponse } from "./ToolResponse.js";
import { withPromiseOrValue } from "../utils/withPromiseOrValue.js";
import { ToolCallReaderImpl } from "./ToolCallReader.js";
var ToolExecutionStream = class extends PipeableTransformStream {
  constructor(options) {
    const toolCallPromises = /* @__PURE__ */ new Map();
    const toolCallControllers = /* @__PURE__ */ new Map();
    super((readable) => {
      const transform = new TransformStream({
        transform(chunk, controller) {
          if (chunk.type !== "part-finish" || chunk.meta.type !== "tool-call") {
            controller.enqueue(chunk);
          }
          const type = chunk.type;
          switch (type) {
            case "part-start":
              if (chunk.part.type === "tool-call") {
                const reader = new ToolCallReaderImpl();
                toolCallControllers.set(chunk.part.toolCallId, reader);
                options.streamCall({
                  reader,
                  toolCallId: chunk.part.toolCallId,
                  toolName: chunk.part.toolName
                });
              }
              break;
            case "text-delta": {
              if (chunk.meta.type === "tool-call") {
                const toolCallId = chunk.meta.toolCallId;
                const controller2 = toolCallControllers.get(toolCallId);
                if (!controller2)
                  throw new Error("No controller found for tool call");
                controller2.appendArgsTextDelta(chunk.textDelta);
              }
              break;
            }
            case "result": {
              if (chunk.meta.type !== "tool-call") break;
              const { toolCallId } = chunk.meta;
              const controller2 = toolCallControllers.get(toolCallId);
              if (!controller2)
                throw new Error("No controller found for tool call");
              controller2.setResponse(
                new ToolResponse({
                  result: chunk.result,
                  artifact: chunk.artifact,
                  isError: chunk.isError
                })
              );
              break;
            }
            case "tool-call-args-text-finish": {
              if (chunk.meta.type !== "tool-call") break;
              const { toolCallId, toolName } = chunk.meta;
              const streamController = toolCallControllers.get(toolCallId);
              if (!streamController)
                throw new Error("No controller found for tool call");
              const promise = withPromiseOrValue(
                () => {
                  let args;
                  try {
                    args = sjson.parse(streamController.argsText);
                  } catch (e) {
                    throw new Error(
                      `Function parameter parsing failed. ${JSON.stringify(e.message)}`
                    );
                  }
                  return options.execute({
                    toolCallId,
                    toolName,
                    args
                  });
                },
                (c) => {
                  if (c === void 0) return;
                  const result = new ToolResponse({
                    artifact: c.artifact,
                    result: c.result,
                    isError: c.isError
                  });
                  streamController.setResponse(result);
                  controller.enqueue({
                    type: "result",
                    path: chunk.path,
                    ...result
                  });
                },
                (e) => {
                  const result = new ToolResponse({
                    result: String(e),
                    isError: true
                  });
                  streamController.setResponse(result);
                  controller.enqueue({
                    type: "result",
                    path: chunk.path,
                    ...result
                  });
                }
              );
              if (promise) {
                toolCallPromises.set(toolCallId, promise);
              }
              break;
            }
            case "part-finish": {
              if (chunk.meta.type !== "tool-call") break;
              const { toolCallId } = chunk.meta;
              const toolCallPromise = toolCallPromises.get(toolCallId);
              if (toolCallPromise) {
                toolCallPromise.then(() => {
                  toolCallPromises.delete(toolCallId);
                  toolCallControllers.delete(toolCallId);
                  controller.enqueue(chunk);
                });
              } else {
                controller.enqueue(chunk);
              }
            }
          }
        },
        async flush() {
          await Promise.all(toolCallPromises.values());
        }
      });
      return readable.pipeThrough(new AssistantMetaTransformStream()).pipeThrough(transform);
    });
  }
};
export {
  ToolExecutionStream
};
//# sourceMappingURL=ToolExecutionStream.js.map