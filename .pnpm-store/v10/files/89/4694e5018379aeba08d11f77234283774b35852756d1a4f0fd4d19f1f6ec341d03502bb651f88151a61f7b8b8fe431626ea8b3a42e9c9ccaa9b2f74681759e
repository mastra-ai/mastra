// src/core/accumulators/assistant-message-accumulator.ts
import { generateId } from "../utils/generateId.js";
import { parsePartialJsonObject } from "../../utils/json/parse-partial-json-object.js";
import { ObjectStreamAccumulator } from "../object/ObjectStreamAccumulator.js";
var createInitialMessage = ({
  unstable_state = null
} = {}) => ({
  role: "assistant",
  status: { type: "running" },
  parts: [],
  get content() {
    return this.parts;
  },
  metadata: {
    unstable_state,
    unstable_data: [],
    unstable_annotations: [],
    steps: [],
    custom: {}
  }
});
var updatePartForPath = (message, chunk, updater) => {
  if (message.parts.length === 0) {
    throw new Error("No parts available to update.");
  }
  if (chunk.path.length !== 1)
    throw new Error("Nested paths are not supported yet.");
  const partIndex = chunk.path[0];
  const updatedPart = updater(message.parts[partIndex]);
  return {
    ...message,
    parts: [
      ...message.parts.slice(0, partIndex),
      updatedPart,
      ...message.parts.slice(partIndex + 1)
    ],
    get content() {
      return this.parts;
    }
  };
};
var handlePartStart = (message, chunk) => {
  const partInit = chunk.part;
  if (partInit.type === "text" || partInit.type === "reasoning") {
    const newTextPart = {
      type: partInit.type,
      text: "",
      status: { type: "running" },
      ...partInit.parentId && { parentId: partInit.parentId }
    };
    return {
      ...message,
      parts: [...message.parts, newTextPart],
      get content() {
        return this.parts;
      }
    };
  } else if (partInit.type === "tool-call") {
    const newToolCallPart = {
      type: "tool-call",
      state: "partial-call",
      status: { type: "running", isArgsComplete: false },
      toolCallId: partInit.toolCallId,
      toolName: partInit.toolName,
      argsText: "",
      args: {},
      ...partInit.parentId && { parentId: partInit.parentId }
    };
    return {
      ...message,
      parts: [...message.parts, newToolCallPart],
      get content() {
        return this.parts;
      }
    };
  } else if (partInit.type === "source") {
    const newSourcePart = {
      type: "source",
      sourceType: partInit.sourceType,
      id: partInit.id,
      url: partInit.url,
      ...partInit.title ? { title: partInit.title } : void 0,
      ...partInit.parentId && { parentId: partInit.parentId }
    };
    return {
      ...message,
      parts: [...message.parts, newSourcePart],
      get content() {
        return this.parts;
      }
    };
  } else if (partInit.type === "file") {
    const newFilePart = {
      type: "file",
      mimeType: partInit.mimeType,
      data: partInit.data
    };
    return {
      ...message,
      parts: [...message.parts, newFilePart],
      get content() {
        return this.parts;
      }
    };
  } else {
    throw new Error(`Unsupported part type: ${partInit.type}`);
  }
};
var handleToolCallArgsTextFinish = (message, chunk) => {
  return updatePartForPath(message, chunk, (part) => {
    if (part.type !== "tool-call") {
      throw new Error("Last is not a tool call");
    }
    if (part.state !== "partial-call") return part;
    return {
      ...part,
      state: "call"
    };
  });
};
var handlePartFinish = (message, chunk) => {
  return updatePartForPath(message, chunk, (part) => ({
    ...part,
    status: { type: "complete", reason: "unknown" }
  }));
};
var handleTextDelta = (message, chunk) => {
  return updatePartForPath(message, chunk, (part) => {
    if (part.type === "text" || part.type === "reasoning") {
      return { ...part, text: part.text + chunk.textDelta };
    } else if (part.type === "tool-call") {
      const newArgsText = part.argsText + chunk.textDelta;
      const newArgs = parsePartialJsonObject(newArgsText) ?? part.args;
      return { ...part, argsText: newArgsText, args: newArgs };
    } else {
      throw new Error(
        "text-delta received but part is neither text nor tool-call"
      );
    }
  });
};
var handleResult = (message, chunk) => {
  return updatePartForPath(message, chunk, (part) => {
    if (part.type === "tool-call") {
      return {
        ...part,
        state: "result",
        ...chunk.artifact !== void 0 ? { artifact: chunk.artifact } : {},
        result: chunk.result,
        isError: chunk.isError ?? false,
        status: { type: "complete", reason: "stop" }
      };
    } else {
      throw new Error("Result chunk received but part is not a tool-call");
    }
  });
};
var handleMessageFinish = (message, chunk) => {
  if (message.status?.type === "incomplete" && message.status?.reason === "error") {
    return message;
  }
  const newStatus = getStatus(chunk);
  return { ...message, status: newStatus };
};
var getStatus = (chunk) => {
  if (chunk.finishReason === "tool-calls") {
    return {
      type: "requires-action",
      reason: "tool-calls"
    };
  } else if (chunk.finishReason === "stop" || chunk.finishReason === "unknown") {
    return {
      type: "complete",
      reason: chunk.finishReason
    };
  } else {
    return {
      type: "incomplete",
      reason: chunk.finishReason
    };
  }
};
var handleAnnotations = (message, chunk) => {
  return {
    ...message,
    metadata: {
      ...message.metadata,
      unstable_annotations: [
        ...message.metadata.unstable_annotations,
        ...chunk.annotations
      ]
    }
  };
};
var handleData = (message, chunk) => {
  return {
    ...message,
    metadata: {
      ...message.metadata,
      unstable_data: [...message.metadata.unstable_data, ...chunk.data]
    }
  };
};
var handleStepStart = (message, chunk) => {
  return {
    ...message,
    metadata: {
      ...message.metadata,
      steps: [
        ...message.metadata.steps,
        { state: "started", messageId: chunk.messageId }
      ]
    }
  };
};
var handleStepFinish = (message, chunk) => {
  const steps = message.metadata.steps.slice();
  const lastIndex = steps.length - 1;
  if (steps.length > 0 && steps[lastIndex]?.state === "started") {
    steps[lastIndex] = {
      ...steps[lastIndex],
      state: "finished",
      finishReason: chunk.finishReason,
      usage: chunk.usage,
      isContinued: chunk.isContinued
    };
  } else {
    steps.push({
      state: "finished",
      messageId: generateId(),
      finishReason: chunk.finishReason,
      usage: chunk.usage,
      isContinued: chunk.isContinued
    });
  }
  return {
    ...message,
    metadata: {
      ...message.metadata,
      steps
    }
  };
};
var handleErrorChunk = (message, chunk) => {
  return {
    ...message,
    status: { type: "incomplete", reason: "error", error: chunk.error }
  };
};
var handleUpdateState = (message, chunk) => {
  const acc = new ObjectStreamAccumulator(message.metadata.unstable_state);
  acc.append(chunk.operations);
  return {
    ...message,
    metadata: {
      ...message.metadata,
      unstable_state: acc.state
    }
  };
};
var throttleCallback = (callback) => {
  let hasScheduled = false;
  return () => {
    if (hasScheduled) return;
    hasScheduled = true;
    queueMicrotask(() => {
      hasScheduled = false;
      callback();
    });
  };
};
var AssistantMessageAccumulator = class extends TransformStream {
  constructor({
    initialMessage,
    throttle,
    onError
  } = {}) {
    let message = initialMessage ?? createInitialMessage();
    let controller;
    const emitChunk = throttle ? throttleCallback(() => {
      controller?.enqueue(message);
    }) : () => {
      controller?.enqueue(message);
    };
    super({
      start(c) {
        controller = c;
      },
      transform(chunk) {
        const type = chunk.type;
        switch (type) {
          case "part-start":
            message = handlePartStart(message, chunk);
            break;
          case "tool-call-args-text-finish":
            message = handleToolCallArgsTextFinish(message, chunk);
            break;
          case "part-finish":
            message = handlePartFinish(message, chunk);
            break;
          case "text-delta":
            message = handleTextDelta(message, chunk);
            break;
          case "result":
            message = handleResult(message, chunk);
            break;
          case "message-finish":
            message = handleMessageFinish(message, chunk);
            break;
          case "annotations":
            message = handleAnnotations(message, chunk);
            break;
          case "data":
            message = handleData(message, chunk);
            break;
          case "step-start":
            message = handleStepStart(message, chunk);
            break;
          case "step-finish":
            message = handleStepFinish(message, chunk);
            break;
          case "error":
            message = handleErrorChunk(message, chunk);
            onError?.(chunk.error);
            break;
          case "update-state":
            message = handleUpdateState(message, chunk);
            break;
          default: {
            const unhandledType = type;
            throw new Error(`Unsupported chunk type: ${unhandledType}`);
          }
        }
        emitChunk();
      },
      flush(controller2) {
        if (message.status?.type === "running") {
          const requiresAction = message.parts?.some(
            (part) => part.type === "tool-call" && (part.state === "call" || part.state === "partial-call") && part.result === void 0
          ) ?? false;
          message = handleMessageFinish(message, {
            type: "message-finish",
            path: [],
            finishReason: requiresAction ? "tool-calls" : "unknown",
            usage: {
              promptTokens: 0,
              completionTokens: 0
            }
          });
          controller2.enqueue(message);
        }
      }
    });
  }
};
export {
  AssistantMessageAccumulator,
  createInitialMessage
};
//# sourceMappingURL=assistant-message-accumulator.js.map