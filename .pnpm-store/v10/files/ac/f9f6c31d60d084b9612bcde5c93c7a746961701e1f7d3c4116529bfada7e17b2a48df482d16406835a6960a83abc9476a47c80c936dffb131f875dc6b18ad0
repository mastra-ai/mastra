// src/core/serialization/data-stream/DataStream.ts
import { AssistantTransformStream } from "../../utils/stream/AssistantTransformStream.js";
import { PipeableTransformStream } from "../../utils/stream/PipeableTransformStream.js";
import { DataStreamStreamChunkType } from "./chunk-types.js";
import { LineDecoderStream } from "../../utils/stream/LineDecoderStream.js";
import {
  DataStreamChunkDecoder,
  DataStreamChunkEncoder
} from "./serialization.js";
import {
  AssistantMetaTransformStream
} from "../../utils/stream/AssistantMetaTransformStream.js";
var DataStreamEncoder = class extends PipeableTransformStream {
  headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "x-vercel-ai-data-stream": "v1"
  });
  constructor() {
    super((readable) => {
      const transform = new TransformStream({
        transform(chunk, controller) {
          const type = chunk.type;
          switch (type) {
            case "part-start": {
              const part = chunk.part;
              if (part.type === "tool-call") {
                const { type: type2, ...value } = part;
                controller.enqueue({
                  type: DataStreamStreamChunkType.StartToolCall,
                  value
                });
              }
              if (part.type === "source") {
                const { type: type2, ...value } = part;
                controller.enqueue({
                  type: DataStreamStreamChunkType.Source,
                  value
                });
              }
              break;
            }
            case "text-delta": {
              const part = chunk.meta;
              switch (part.type) {
                case "text": {
                  if (part.parentId) {
                    controller.enqueue({
                      type: DataStreamStreamChunkType.AuiTextDelta,
                      value: {
                        textDelta: chunk.textDelta,
                        parentId: part.parentId
                      }
                    });
                  } else {
                    controller.enqueue({
                      type: DataStreamStreamChunkType.TextDelta,
                      value: chunk.textDelta
                    });
                  }
                  break;
                }
                case "reasoning": {
                  if (part.parentId) {
                    controller.enqueue({
                      type: DataStreamStreamChunkType.AuiReasoningDelta,
                      value: {
                        reasoningDelta: chunk.textDelta,
                        parentId: part.parentId
                      }
                    });
                  } else {
                    controller.enqueue({
                      type: DataStreamStreamChunkType.ReasoningDelta,
                      value: chunk.textDelta
                    });
                  }
                  break;
                }
                case "tool-call": {
                  controller.enqueue({
                    type: DataStreamStreamChunkType.ToolCallArgsTextDelta,
                    value: {
                      toolCallId: part.toolCallId,
                      argsTextDelta: chunk.textDelta
                    }
                  });
                  break;
                }
                default:
                  throw new Error(
                    `Unsupported part type for text-delta: ${part.type}`
                  );
              }
              break;
            }
            case "result": {
              const part = chunk.meta;
              if (part.type !== "tool-call") {
                throw new Error(
                  `Result chunk on non-tool-call part not supported: ${part.type}`
                );
              }
              controller.enqueue({
                type: DataStreamStreamChunkType.ToolCallResult,
                value: {
                  toolCallId: part.toolCallId,
                  result: chunk.result,
                  artifact: chunk.artifact,
                  ...chunk.isError ? { isError: chunk.isError } : {}
                }
              });
              break;
            }
            case "step-start": {
              const { type: type2, ...value } = chunk;
              controller.enqueue({
                type: DataStreamStreamChunkType.StartStep,
                value
              });
              break;
            }
            case "step-finish": {
              const { type: type2, ...value } = chunk;
              controller.enqueue({
                type: DataStreamStreamChunkType.FinishStep,
                value
              });
              break;
            }
            case "message-finish": {
              const { type: type2, ...value } = chunk;
              controller.enqueue({
                type: DataStreamStreamChunkType.FinishMessage,
                value
              });
              break;
            }
            case "error": {
              controller.enqueue({
                type: DataStreamStreamChunkType.Error,
                value: chunk.error
              });
              break;
            }
            case "annotations": {
              controller.enqueue({
                type: DataStreamStreamChunkType.Annotation,
                value: chunk.annotations
              });
              break;
            }
            case "data": {
              controller.enqueue({
                type: DataStreamStreamChunkType.Data,
                value: chunk.data
              });
              break;
            }
            case "update-state": {
              controller.enqueue({
                type: DataStreamStreamChunkType.AuiUpdateStateOperations,
                value: chunk.operations
              });
              break;
            }
            // TODO ignore for now
            // in the future, we should create a handler that waits for text parts to finish before continuing
            case "tool-call-args-text-finish":
            case "part-finish":
              break;
            default: {
              const exhaustiveCheck = type;
              throw new Error(`Unsupported chunk type: ${exhaustiveCheck}`);
            }
          }
        }
      });
      return readable.pipeThrough(new AssistantMetaTransformStream()).pipeThrough(transform).pipeThrough(new DataStreamChunkEncoder()).pipeThrough(new TextEncoderStream());
    });
  }
};
var TOOL_CALL_ARGS_CLOSING_CHUNKS = [
  DataStreamStreamChunkType.StartToolCall,
  DataStreamStreamChunkType.ToolCall,
  DataStreamStreamChunkType.TextDelta,
  DataStreamStreamChunkType.ReasoningDelta,
  DataStreamStreamChunkType.Source,
  DataStreamStreamChunkType.Error,
  DataStreamStreamChunkType.FinishStep,
  DataStreamStreamChunkType.FinishMessage,
  DataStreamStreamChunkType.AuiTextDelta,
  DataStreamStreamChunkType.AuiReasoningDelta
];
var DataStreamDecoder = class extends PipeableTransformStream {
  constructor() {
    super((readable) => {
      const toolCallControllers = /* @__PURE__ */ new Map();
      let activeToolCallArgsText;
      const transform = new AssistantTransformStream({
        transform(chunk, controller) {
          const { type, value } = chunk;
          if (TOOL_CALL_ARGS_CLOSING_CHUNKS.includes(type)) {
            activeToolCallArgsText?.close();
            activeToolCallArgsText = void 0;
          }
          switch (type) {
            case DataStreamStreamChunkType.ReasoningDelta:
              controller.appendReasoning(value);
              break;
            case DataStreamStreamChunkType.TextDelta:
              controller.appendText(value);
              break;
            case DataStreamStreamChunkType.AuiTextDelta:
              controller.withParentId(value.parentId).appendText(value.textDelta);
              break;
            case DataStreamStreamChunkType.AuiReasoningDelta:
              controller.withParentId(value.parentId).appendReasoning(value.reasoningDelta);
              break;
            case DataStreamStreamChunkType.StartToolCall: {
              const { toolCallId, toolName, parentId } = value;
              const ctrl = parentId ? controller.withParentId(parentId) : controller;
              if (toolCallControllers.has(toolCallId))
                throw new Error(
                  "Encountered duplicate tool call id: " + toolCallId
                );
              const toolCallController = ctrl.addToolCallPart({
                toolCallId,
                toolName
              });
              toolCallControllers.set(toolCallId, toolCallController);
              activeToolCallArgsText = toolCallController.argsText;
              break;
            }
            case DataStreamStreamChunkType.ToolCallArgsTextDelta: {
              const { toolCallId, argsTextDelta } = value;
              const toolCallController = toolCallControllers.get(toolCallId);
              if (!toolCallController)
                throw new Error(
                  "Encountered tool call with unknown id: " + toolCallId
                );
              toolCallController.argsText.append(argsTextDelta);
              break;
            }
            case DataStreamStreamChunkType.ToolCallResult: {
              const { toolCallId, artifact, result, isError } = value;
              const toolCallController = toolCallControllers.get(toolCallId);
              if (!toolCallController)
                throw new Error(
                  "Encountered tool call result with unknown id: " + toolCallId
                );
              toolCallController.setResponse({
                artifact,
                result,
                isError
              });
              break;
            }
            case DataStreamStreamChunkType.ToolCall: {
              const { toolCallId, toolName, args } = value;
              let toolCallController = toolCallControllers.get(toolCallId);
              if (toolCallController) {
                toolCallController.argsText.close();
              } else {
                toolCallController = controller.addToolCallPart({
                  toolCallId,
                  toolName,
                  args
                });
                toolCallControllers.set(toolCallId, toolCallController);
              }
              break;
            }
            case DataStreamStreamChunkType.FinishMessage:
              controller.enqueue({
                type: "message-finish",
                path: [],
                ...value
              });
              break;
            case DataStreamStreamChunkType.StartStep:
              controller.enqueue({
                type: "step-start",
                path: [],
                ...value
              });
              break;
            case DataStreamStreamChunkType.FinishStep:
              controller.enqueue({
                type: "step-finish",
                path: [],
                ...value
              });
              break;
            case DataStreamStreamChunkType.Data:
              controller.enqueue({
                type: "data",
                path: [],
                data: value
              });
              break;
            case DataStreamStreamChunkType.Annotation:
              controller.enqueue({
                type: "annotations",
                path: [],
                annotations: value
              });
              break;
            case DataStreamStreamChunkType.Source: {
              const { parentId, ...sourceData } = value;
              const ctrl = parentId ? controller.withParentId(parentId) : controller;
              ctrl.appendSource({
                type: "source",
                ...sourceData
              });
              break;
            }
            case DataStreamStreamChunkType.Error:
              controller.enqueue({
                type: "error",
                path: [],
                error: value
              });
              break;
            case DataStreamStreamChunkType.File:
              controller.appendFile({
                type: "file",
                ...value
              });
              break;
            case DataStreamStreamChunkType.AuiUpdateStateOperations:
              controller.enqueue({
                type: "update-state",
                path: [],
                operations: value
              });
              break;
            case DataStreamStreamChunkType.ReasoningSignature:
            case DataStreamStreamChunkType.RedactedReasoning:
              break;
            default: {
              const exhaustiveCheck = type;
              throw new Error(`unsupported chunk type: ${exhaustiveCheck}`);
            }
          }
        },
        flush() {
          activeToolCallArgsText?.close();
          activeToolCallArgsText = void 0;
          toolCallControllers.forEach((controller) => controller.close());
          toolCallControllers.clear();
        }
      });
      return readable.pipeThrough(new TextDecoderStream()).pipeThrough(new LineDecoderStream()).pipeThrough(new DataStreamChunkDecoder()).pipeThrough(transform);
    });
  }
};
export {
  DataStreamDecoder,
  DataStreamEncoder
};
//# sourceMappingURL=DataStream.js.map