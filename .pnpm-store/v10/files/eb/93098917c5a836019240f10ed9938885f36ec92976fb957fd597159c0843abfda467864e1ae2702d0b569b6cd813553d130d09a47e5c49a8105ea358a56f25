"use client";

// src/runtimes/external-store/external-message-converter.tsx
import { useMemo } from "react";
import { ThreadMessageConverter } from "./ThreadMessageConverter.js";
import {
  getExternalStoreMessages,
  symbolInnerMessage
} from "./getExternalStoreMessage.js";
import { fromThreadMessageLike } from "./ThreadMessageLike.js";
import { getAutoStatus, isAutoStatus } from "./auto-status.js";
var joinExternalMessages = (messages) => {
  const assistantMessage = {
    role: "assistant",
    content: []
  };
  for (const output of messages) {
    if (output.role === "tool") {
      const toolCallIdx = assistantMessage.content.findIndex(
        (c) => c.type === "tool-call" && c.toolCallId === output.toolCallId
      );
      if (toolCallIdx !== -1) {
        const toolCall = assistantMessage.content[toolCallIdx];
        if (output.toolName) {
          if (toolCall.toolName !== output.toolName)
            throw new Error(
              `Tool call name ${output.toolCallId} ${output.toolName} does not match existing tool call ${toolCall.toolName}`
            );
        }
        assistantMessage.content[toolCallIdx] = {
          ...toolCall,
          ...{
            [symbolInnerMessage]: [
              ...toolCall[symbolInnerMessage] ?? [],
              output
            ]
          },
          result: output.result,
          artifact: output.artifact,
          isError: output.isError
        };
      } else {
        throw new Error(
          `Tool call ${output.toolCallId} ${output.toolName} not found in assistant message`
        );
      }
    } else {
      const role = output.role;
      const content = (typeof output.content === "string" ? [{ type: "text", text: output.content }] : output.content).map((c) => ({
        ...c,
        ...{ [symbolInnerMessage]: [output] }
      }));
      switch (role) {
        case "system":
        case "user":
          return {
            ...output,
            content
          };
        case "assistant":
          if (assistantMessage.content.length === 0) {
            assistantMessage.id = output.id;
            assistantMessage.createdAt ??= output.createdAt;
            assistantMessage.status ??= output.status;
            if (output.attachments) {
              assistantMessage.attachments = [
                ...assistantMessage.attachments ?? [],
                ...output.attachments
              ];
            }
            if (output.metadata) {
              assistantMessage.metadata ??= {};
              if (output.metadata.unstable_state) {
                assistantMessage.metadata.unstable_state = output.metadata.unstable_state;
              }
              if (output.metadata.unstable_annotations) {
                assistantMessage.metadata.unstable_annotations = [
                  ...assistantMessage.metadata.unstable_annotations ?? [],
                  ...output.metadata.unstable_annotations
                ];
              }
              if (output.metadata.unstable_data) {
                assistantMessage.metadata.unstable_data = [
                  ...assistantMessage.metadata.unstable_data ?? [],
                  ...output.metadata.unstable_data
                ];
              }
              if (output.metadata.steps) {
                assistantMessage.metadata.steps = [
                  ...assistantMessage.metadata.steps ?? [],
                  ...output.metadata.steps
                ];
              }
              if (output.metadata.custom) {
                assistantMessage.metadata.custom = {
                  ...assistantMessage.metadata.custom ?? {},
                  ...output.metadata.custom
                };
              }
            }
          }
          assistantMessage.content.push(...content);
          break;
        default: {
          const unsupportedRole = role;
          throw new Error(`Unknown message role: ${unsupportedRole}`);
        }
      }
    }
  }
  return assistantMessage;
};
var chunkExternalMessages = (callbackResults, joinStrategy) => {
  const results = [];
  let isAssistant = false;
  let pendingNone = false;
  let inputs = [];
  let outputs = [];
  const flush = () => {
    if (outputs.length) {
      results.push({
        inputs,
        outputs
      });
    }
    inputs = [];
    outputs = [];
    isAssistant = false;
    pendingNone = false;
  };
  for (const callbackResult of callbackResults) {
    for (const output of callbackResult.outputs) {
      if (pendingNone && output.role !== "tool" || !isAssistant || output.role === "user" || output.role === "system") {
        flush();
      }
      isAssistant = output.role === "assistant" || output.role === "tool";
      if (inputs.at(-1) !== callbackResult.input) {
        inputs.push(callbackResult.input);
      }
      outputs.push(output);
      if (output.role === "assistant" && (output.convertConfig?.joinStrategy === "none" || joinStrategy === "none")) {
        pendingNone = true;
      }
    }
  }
  flush();
  return results;
};
var convertExternalMessages = (messages, callback, isRunning) => {
  const callbackResults = [];
  for (const message of messages) {
    const output = callback(message);
    const outputs = Array.isArray(output) ? output : [output];
    const result = { input: message, outputs };
    callbackResults.push(result);
  }
  const chunks = chunkExternalMessages(callbackResults);
  return chunks.map((message, idx) => {
    const isLast = idx === chunks.length - 1;
    const joined = joinExternalMessages(message.outputs);
    const hasPendingToolCalls = typeof joined.content === "object" && joined.content.some(
      (c) => c.type === "tool-call" && c.result === void 0
    );
    const autoStatus = getAutoStatus(isLast, isRunning, hasPendingToolCalls);
    const newMessage = fromThreadMessageLike(
      joined,
      idx.toString(),
      autoStatus
    );
    newMessage[symbolInnerMessage] = message.inputs;
    return newMessage;
  });
};
var useExternalMessageConverter = ({
  callback,
  messages,
  isRunning,
  joinStrategy
}) => {
  const state = useMemo(
    () => ({
      callback,
      callbackCache: /* @__PURE__ */ new WeakMap(),
      chunkCache: /* @__PURE__ */ new WeakMap(),
      converterCache: new ThreadMessageConverter()
    }),
    [callback]
  );
  return useMemo(() => {
    const callbackResults = [];
    for (const message of messages) {
      let result = state.callbackCache.get(message);
      if (!result) {
        const output = state.callback(message);
        const outputs = Array.isArray(output) ? output : [output];
        result = { input: message, outputs };
        state.callbackCache.set(message, result);
      }
      callbackResults.push(result);
    }
    const chunks = chunkExternalMessages(callbackResults, joinStrategy).map(
      (m) => {
        const key = m.outputs[0];
        if (!key) return m;
        const cached = state.chunkCache.get(key);
        if (cached && shallowArrayEqual(cached.outputs, m.outputs))
          return cached;
        state.chunkCache.set(key, m);
        return m;
      }
    );
    const threadMessages = state.converterCache.convertMessages(
      chunks,
      (cache, message, idx) => {
        const isLast = idx === chunks.length - 1;
        const joined = joinExternalMessages(message.outputs);
        const hasPendingToolCalls = typeof joined.content === "object" && joined.content.some(
          (c) => c.type === "tool-call" && c.result === void 0
        );
        const autoStatus = getAutoStatus(
          isLast,
          isRunning,
          hasPendingToolCalls
        );
        if (cache && (cache.role !== "assistant" || !isAutoStatus(cache.status) || cache.status === autoStatus)) {
          const inputs = getExternalStoreMessages(cache);
          if (shallowArrayEqual(inputs, message.inputs)) {
            return cache;
          }
        }
        const newMessage = fromThreadMessageLike(
          joined,
          idx.toString(),
          autoStatus
        );
        newMessage[symbolInnerMessage] = message.inputs;
        return newMessage;
      }
    );
    threadMessages[symbolInnerMessage] = messages;
    return threadMessages;
  }, [state, messages, isRunning, joinStrategy]);
};
var shallowArrayEqual = (a, b) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};
export {
  convertExternalMessages,
  useExternalMessageConverter
};
//# sourceMappingURL=external-message-converter.js.map