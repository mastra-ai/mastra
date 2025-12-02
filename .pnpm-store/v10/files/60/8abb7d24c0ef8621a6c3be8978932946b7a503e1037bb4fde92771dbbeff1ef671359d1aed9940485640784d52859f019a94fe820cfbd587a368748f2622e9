// src/core/tool/toolResultStream.ts
import { ToolResponse } from "./ToolResponse.js";
import { ToolExecutionStream } from "./ToolExecutionStream.js";
var isStandardSchemaV1 = (schema) => {
  return typeof schema === "object" && schema !== null && "~standard" in schema && schema["~standard"].version === 1;
};
function getToolResponse(tools, abortSignal, toolCall, human) {
  const tool = tools?.[toolCall.toolName];
  if (!tool || !tool.execute) return void 0;
  const getResult = async (toolExecute) => {
    let executeFn = toolExecute;
    if (isStandardSchemaV1(tool.parameters)) {
      let result2 = tool.parameters["~standard"].validate(toolCall.args);
      if (result2 instanceof Promise) result2 = await result2;
      if (result2.issues) {
        executeFn = tool.experimental_onSchemaValidationError ?? (() => {
          throw new Error(
            `Function parameter validation failed. ${JSON.stringify(result2.issues)}`
          );
        });
      }
    }
    const result = await executeFn(toolCall.args, {
      toolCallId: toolCall.toolCallId,
      abortSignal,
      human: (payload) => human(toolCall.toolCallId, payload)
    });
    return ToolResponse.toResponse(result);
  };
  return getResult(tool.execute);
}
function getToolStreamResponse(tools, abortSignal, reader, context, human) {
  tools?.[context.toolName]?.streamCall?.(reader, {
    toolCallId: context.toolCallId,
    abortSignal,
    human: (payload) => human(context.toolCallId, payload)
  });
}
async function unstable_runPendingTools(message, tools, abortSignal, human) {
  for (const part of message.parts) {
    if (part.type === "tool-call") {
      const promiseOrUndefined = getToolResponse(
        tools,
        abortSignal,
        part,
        human ?? (async () => {
          throw new Error(
            "Tool human input is not supported in this context"
          );
        })
      );
      if (promiseOrUndefined) {
        const result = await promiseOrUndefined;
        const updatedParts = message.parts.map((p) => {
          if (p.type === "tool-call" && p.toolCallId === part.toolCallId) {
            return {
              ...p,
              state: "result",
              ...result.artifact !== void 0 ? { artifact: result.artifact } : {},
              result: result.result,
              isError: result.isError
            };
          }
          return p;
        });
        message = {
          ...message,
          parts: updatedParts,
          content: updatedParts
        };
      }
    }
  }
  return message;
}
function toolResultStream(tools, abortSignal, human) {
  const toolsFn = typeof tools === "function" ? tools : () => tools;
  const abortSignalFn = typeof abortSignal === "function" ? abortSignal : () => abortSignal;
  return new ToolExecutionStream({
    execute: (toolCall) => getToolResponse(toolsFn(), abortSignalFn(), toolCall, human),
    streamCall: ({ reader, ...context }) => getToolStreamResponse(toolsFn(), abortSignalFn(), reader, context, human)
  });
}
export {
  toolResultStream,
  unstable_runPendingTools
};
//# sourceMappingURL=toolResultStream.js.map