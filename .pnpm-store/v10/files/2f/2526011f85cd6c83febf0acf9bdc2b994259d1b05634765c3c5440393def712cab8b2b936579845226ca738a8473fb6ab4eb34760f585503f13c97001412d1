import { Tool, ToolCallReader, ToolExecuteFunction } from "./tool-types";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { ToolResponse } from "./ToolResponse";
import { ToolExecutionStream } from "./ToolExecutionStream";
import { AssistantMessage } from "../utils/types";
import { ReadonlyJSONObject, ReadonlyJSONValue } from "../../utils";

const isStandardSchemaV1 = (
  schema: unknown,
): schema is StandardSchemaV1<unknown> => {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "~standard" in schema &&
    (schema as StandardSchemaV1<unknown>)["~standard"].version === 1
  );
};

function getToolResponse(
  tools: Record<string, Tool> | undefined,
  abortSignal: AbortSignal,
  toolCall: {
    toolCallId: string;
    toolName: string;
    args: ReadonlyJSONObject;
  },
  human: (toolCallId: string, payload: unknown) => Promise<unknown>,
) {
  const tool = tools?.[toolCall.toolName];
  if (!tool || !tool.execute) return undefined;

  const getResult = async (
    toolExecute: ToolExecuteFunction<ReadonlyJSONObject, unknown>,
  ): Promise<ToolResponse<ReadonlyJSONValue>> => {
    let executeFn = toolExecute;

    if (isStandardSchemaV1(tool.parameters)) {
      let result = tool.parameters["~standard"].validate(toolCall.args);
      if (result instanceof Promise) result = await result;

      if (result.issues) {
        executeFn =
          tool.experimental_onSchemaValidationError ??
          (() => {
            throw new Error(
              `Function parameter validation failed. ${JSON.stringify(result.issues)}`,
            );
          });
      }
    }

    const result = (await executeFn(toolCall.args, {
      toolCallId: toolCall.toolCallId,
      abortSignal,
      human: (payload: unknown) => human(toolCall.toolCallId, payload),
    })) as unknown as ReadonlyJSONValue;
    return ToolResponse.toResponse(result);
  };

  return getResult(tool.execute);
}

function getToolStreamResponse(
  tools: Record<string, Tool> | undefined,
  abortSignal: AbortSignal,
  reader: ToolCallReader<any, ReadonlyJSONValue>,
  context: {
    toolCallId: string;
    toolName: string;
  },
  human: (toolCallId: string, payload: unknown) => Promise<unknown>,
) {
  tools?.[context.toolName]?.streamCall?.(reader, {
    toolCallId: context.toolCallId,
    abortSignal,
    human: (payload: unknown) => human(context.toolCallId, payload),
  });
}

export async function unstable_runPendingTools(
  message: AssistantMessage,
  tools: Record<string, Tool> | undefined,
  abortSignal: AbortSignal,
  human: (toolCallId: string, payload: unknown) => Promise<unknown>,
) {
  // TODO parallel tool calling
  for (const part of message.parts) {
    if (part.type === "tool-call") {
      const promiseOrUndefined = getToolResponse(
        tools,
        abortSignal,
        part,
        human ??
          (async () => {
            throw new Error(
              "Tool human input is not supported in this context",
            );
          }),
      );
      if (promiseOrUndefined) {
        const result = await promiseOrUndefined;
        const updatedParts = message.parts.map((p) => {
          if (p.type === "tool-call" && p.toolCallId === part.toolCallId) {
            return {
              ...p,
              state: "result" as const,
              ...(result.artifact !== undefined
                ? { artifact: result.artifact }
                : {}),
              result: result.result as ReadonlyJSONValue,
              isError: result.isError,
            };
          }
          return p;
        });
        message = {
          ...message,
          parts: updatedParts,
          content: updatedParts,
        };
      }
    }
  }
  return message;
}

export function toolResultStream(
  tools:
    | Record<string, Tool>
    | (() => Record<string, Tool> | undefined)
    | undefined,
  abortSignal: AbortSignal | (() => AbortSignal),
  human: (toolCallId: string, payload: unknown) => Promise<unknown>,
) {
  const toolsFn = typeof tools === "function" ? tools : () => tools;
  const abortSignalFn =
    typeof abortSignal === "function" ? abortSignal : () => abortSignal;
  return new ToolExecutionStream({
    execute: (toolCall) =>
      getToolResponse(toolsFn(), abortSignalFn(), toolCall, human),
    streamCall: ({ reader, ...context }) =>
      getToolStreamResponse(toolsFn(), abortSignalFn(), reader, context, human),
  });
}
