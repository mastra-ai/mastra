"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  asSchema: () => asSchema,
  callChatApi: () => callChatApi,
  callCompletionApi: () => callCompletionApi,
  extractMaxToolInvocationStep: () => extractMaxToolInvocationStep,
  fillMessageParts: () => fillMessageParts,
  formatAssistantStreamPart: () => formatAssistantStreamPart,
  formatDataStreamPart: () => formatDataStreamPart,
  generateId: () => import_provider_utils5.generateId,
  getMessageParts: () => getMessageParts,
  getTextFromDataUrl: () => getTextFromDataUrl,
  isAssistantMessageWithCompletedToolCalls: () => isAssistantMessageWithCompletedToolCalls,
  isDeepEqualData: () => isDeepEqualData,
  jsonSchema: () => jsonSchema,
  parseAssistantStreamPart: () => parseAssistantStreamPart,
  parseDataStreamPart: () => parseDataStreamPart,
  parsePartialJson: () => parsePartialJson,
  prepareAttachmentsForRequest: () => prepareAttachmentsForRequest,
  processAssistantStream: () => processAssistantStream,
  processDataStream: () => processDataStream,
  processTextStream: () => processTextStream,
  shouldResubmitMessages: () => shouldResubmitMessages,
  updateToolCallResult: () => updateToolCallResult,
  zodSchema: () => zodSchema
});
module.exports = __toCommonJS(src_exports);
var import_provider_utils5 = require("@ai-sdk/provider-utils");

// src/assistant-stream-parts.ts
var textStreamPart = {
  code: "0",
  name: "text",
  parse: (value) => {
    if (typeof value !== "string") {
      throw new Error('"text" parts expect a string value.');
    }
    return { type: "text", value };
  }
};
var errorStreamPart = {
  code: "3",
  name: "error",
  parse: (value) => {
    if (typeof value !== "string") {
      throw new Error('"error" parts expect a string value.');
    }
    return { type: "error", value };
  }
};
var assistantMessageStreamPart = {
  code: "4",
  name: "assistant_message",
  parse: (value) => {
    if (value == null || typeof value !== "object" || !("id" in value) || !("role" in value) || !("content" in value) || typeof value.id !== "string" || typeof value.role !== "string" || value.role !== "assistant" || !Array.isArray(value.content) || !value.content.every(
      (item) => item != null && typeof item === "object" && "type" in item && item.type === "text" && "text" in item && item.text != null && typeof item.text === "object" && "value" in item.text && typeof item.text.value === "string"
    )) {
      throw new Error(
        '"assistant_message" parts expect an object with an "id", "role", and "content" property.'
      );
    }
    return {
      type: "assistant_message",
      value
    };
  }
};
var assistantControlDataStreamPart = {
  code: "5",
  name: "assistant_control_data",
  parse: (value) => {
    if (value == null || typeof value !== "object" || !("threadId" in value) || !("messageId" in value) || typeof value.threadId !== "string" || typeof value.messageId !== "string") {
      throw new Error(
        '"assistant_control_data" parts expect an object with a "threadId" and "messageId" property.'
      );
    }
    return {
      type: "assistant_control_data",
      value: {
        threadId: value.threadId,
        messageId: value.messageId
      }
    };
  }
};
var dataMessageStreamPart = {
  code: "6",
  name: "data_message",
  parse: (value) => {
    if (value == null || typeof value !== "object" || !("role" in value) || !("data" in value) || typeof value.role !== "string" || value.role !== "data") {
      throw new Error(
        '"data_message" parts expect an object with a "role" and "data" property.'
      );
    }
    return {
      type: "data_message",
      value
    };
  }
};
var assistantStreamParts = [
  textStreamPart,
  errorStreamPart,
  assistantMessageStreamPart,
  assistantControlDataStreamPart,
  dataMessageStreamPart
];
var assistantStreamPartsByCode = {
  [textStreamPart.code]: textStreamPart,
  [errorStreamPart.code]: errorStreamPart,
  [assistantMessageStreamPart.code]: assistantMessageStreamPart,
  [assistantControlDataStreamPart.code]: assistantControlDataStreamPart,
  [dataMessageStreamPart.code]: dataMessageStreamPart
};
var StreamStringPrefixes = {
  [textStreamPart.name]: textStreamPart.code,
  [errorStreamPart.name]: errorStreamPart.code,
  [assistantMessageStreamPart.name]: assistantMessageStreamPart.code,
  [assistantControlDataStreamPart.name]: assistantControlDataStreamPart.code,
  [dataMessageStreamPart.name]: dataMessageStreamPart.code
};
var validCodes = assistantStreamParts.map((part) => part.code);
var parseAssistantStreamPart = (line) => {
  const firstSeparatorIndex = line.indexOf(":");
  if (firstSeparatorIndex === -1) {
    throw new Error("Failed to parse stream string. No separator found.");
  }
  const prefix = line.slice(0, firstSeparatorIndex);
  if (!validCodes.includes(prefix)) {
    throw new Error(`Failed to parse stream string. Invalid code ${prefix}.`);
  }
  const code = prefix;
  const textValue = line.slice(firstSeparatorIndex + 1);
  const jsonValue = JSON.parse(textValue);
  return assistantStreamPartsByCode[code].parse(jsonValue);
};
function formatAssistantStreamPart(type, value) {
  const streamPart = assistantStreamParts.find((part) => part.name === type);
  if (!streamPart) {
    throw new Error(`Invalid stream part type: ${type}`);
  }
  return `${streamPart.code}:${JSON.stringify(value)}
`;
}

// src/process-chat-response.ts
var import_provider_utils2 = require("@ai-sdk/provider-utils");

// src/duplicated/usage.ts
function calculateLanguageModelUsage({
  promptTokens,
  completionTokens
}) {
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens
  };
}

// src/parse-partial-json.ts
var import_provider_utils = require("@ai-sdk/provider-utils");

// src/fix-json.ts
function fixJson(input) {
  const stack = ["ROOT"];
  let lastValidIndex = -1;
  let literalStart = null;
  function processValueStart(char, i, swapState) {
    {
      switch (char) {
        case '"': {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_STRING");
          break;
        }
        case "f":
        case "t":
        case "n": {
          lastValidIndex = i;
          literalStart = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_LITERAL");
          break;
        }
        case "-": {
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_NUMBER");
          break;
        }
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9": {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_NUMBER");
          break;
        }
        case "{": {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_OBJECT_START");
          break;
        }
        case "[": {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_ARRAY_START");
          break;
        }
      }
    }
  }
  function processAfterObjectValue(char, i) {
    switch (char) {
      case ",": {
        stack.pop();
        stack.push("INSIDE_OBJECT_AFTER_COMMA");
        break;
      }
      case "}": {
        lastValidIndex = i;
        stack.pop();
        break;
      }
    }
  }
  function processAfterArrayValue(char, i) {
    switch (char) {
      case ",": {
        stack.pop();
        stack.push("INSIDE_ARRAY_AFTER_COMMA");
        break;
      }
      case "]": {
        lastValidIndex = i;
        stack.pop();
        break;
      }
    }
  }
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const currentState = stack[stack.length - 1];
    switch (currentState) {
      case "ROOT":
        processValueStart(char, i, "FINISH");
        break;
      case "INSIDE_OBJECT_START": {
        switch (char) {
          case '"': {
            stack.pop();
            stack.push("INSIDE_OBJECT_KEY");
            break;
          }
          case "}": {
            lastValidIndex = i;
            stack.pop();
            break;
          }
        }
        break;
      }
      case "INSIDE_OBJECT_AFTER_COMMA": {
        switch (char) {
          case '"': {
            stack.pop();
            stack.push("INSIDE_OBJECT_KEY");
            break;
          }
        }
        break;
      }
      case "INSIDE_OBJECT_KEY": {
        switch (char) {
          case '"': {
            stack.pop();
            stack.push("INSIDE_OBJECT_AFTER_KEY");
            break;
          }
        }
        break;
      }
      case "INSIDE_OBJECT_AFTER_KEY": {
        switch (char) {
          case ":": {
            stack.pop();
            stack.push("INSIDE_OBJECT_BEFORE_VALUE");
            break;
          }
        }
        break;
      }
      case "INSIDE_OBJECT_BEFORE_VALUE": {
        processValueStart(char, i, "INSIDE_OBJECT_AFTER_VALUE");
        break;
      }
      case "INSIDE_OBJECT_AFTER_VALUE": {
        processAfterObjectValue(char, i);
        break;
      }
      case "INSIDE_STRING": {
        switch (char) {
          case '"': {
            stack.pop();
            lastValidIndex = i;
            break;
          }
          case "\\": {
            stack.push("INSIDE_STRING_ESCAPE");
            break;
          }
          default: {
            lastValidIndex = i;
          }
        }
        break;
      }
      case "INSIDE_ARRAY_START": {
        switch (char) {
          case "]": {
            lastValidIndex = i;
            stack.pop();
            break;
          }
          default: {
            lastValidIndex = i;
            processValueStart(char, i, "INSIDE_ARRAY_AFTER_VALUE");
            break;
          }
        }
        break;
      }
      case "INSIDE_ARRAY_AFTER_VALUE": {
        switch (char) {
          case ",": {
            stack.pop();
            stack.push("INSIDE_ARRAY_AFTER_COMMA");
            break;
          }
          case "]": {
            lastValidIndex = i;
            stack.pop();
            break;
          }
          default: {
            lastValidIndex = i;
            break;
          }
        }
        break;
      }
      case "INSIDE_ARRAY_AFTER_COMMA": {
        processValueStart(char, i, "INSIDE_ARRAY_AFTER_VALUE");
        break;
      }
      case "INSIDE_STRING_ESCAPE": {
        stack.pop();
        lastValidIndex = i;
        break;
      }
      case "INSIDE_NUMBER": {
        switch (char) {
          case "0":
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9": {
            lastValidIndex = i;
            break;
          }
          case "e":
          case "E":
          case "-":
          case ".": {
            break;
          }
          case ",": {
            stack.pop();
            if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
              processAfterArrayValue(char, i);
            }
            if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
              processAfterObjectValue(char, i);
            }
            break;
          }
          case "}": {
            stack.pop();
            if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
              processAfterObjectValue(char, i);
            }
            break;
          }
          case "]": {
            stack.pop();
            if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
              processAfterArrayValue(char, i);
            }
            break;
          }
          default: {
            stack.pop();
            break;
          }
        }
        break;
      }
      case "INSIDE_LITERAL": {
        const partialLiteral = input.substring(literalStart, i + 1);
        if (!"false".startsWith(partialLiteral) && !"true".startsWith(partialLiteral) && !"null".startsWith(partialLiteral)) {
          stack.pop();
          if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
            processAfterObjectValue(char, i);
          } else if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
            processAfterArrayValue(char, i);
          }
        } else {
          lastValidIndex = i;
        }
        break;
      }
    }
  }
  let result = input.slice(0, lastValidIndex + 1);
  for (let i = stack.length - 1; i >= 0; i--) {
    const state = stack[i];
    switch (state) {
      case "INSIDE_STRING": {
        result += '"';
        break;
      }
      case "INSIDE_OBJECT_KEY":
      case "INSIDE_OBJECT_AFTER_KEY":
      case "INSIDE_OBJECT_AFTER_COMMA":
      case "INSIDE_OBJECT_START":
      case "INSIDE_OBJECT_BEFORE_VALUE":
      case "INSIDE_OBJECT_AFTER_VALUE": {
        result += "}";
        break;
      }
      case "INSIDE_ARRAY_START":
      case "INSIDE_ARRAY_AFTER_COMMA":
      case "INSIDE_ARRAY_AFTER_VALUE": {
        result += "]";
        break;
      }
      case "INSIDE_LITERAL": {
        const partialLiteral = input.substring(literalStart, input.length);
        if ("true".startsWith(partialLiteral)) {
          result += "true".slice(partialLiteral.length);
        } else if ("false".startsWith(partialLiteral)) {
          result += "false".slice(partialLiteral.length);
        } else if ("null".startsWith(partialLiteral)) {
          result += "null".slice(partialLiteral.length);
        }
      }
    }
  }
  return result;
}

// src/parse-partial-json.ts
function parsePartialJson(jsonText) {
  if (jsonText === void 0) {
    return { value: void 0, state: "undefined-input" };
  }
  let result = (0, import_provider_utils.safeParseJSON)({ text: jsonText });
  if (result.success) {
    return { value: result.value, state: "successful-parse" };
  }
  result = (0, import_provider_utils.safeParseJSON)({ text: fixJson(jsonText) });
  if (result.success) {
    return { value: result.value, state: "repaired-parse" };
  }
  return { value: void 0, state: "failed-parse" };
}

// src/data-stream-parts.ts
var textStreamPart2 = {
  code: "0",
  name: "text",
  parse: (value) => {
    if (typeof value !== "string") {
      throw new Error('"text" parts expect a string value.');
    }
    return { type: "text", value };
  }
};
var dataStreamPart = {
  code: "2",
  name: "data",
  parse: (value) => {
    if (!Array.isArray(value)) {
      throw new Error('"data" parts expect an array value.');
    }
    return { type: "data", value };
  }
};
var errorStreamPart2 = {
  code: "3",
  name: "error",
  parse: (value) => {
    if (typeof value !== "string") {
      throw new Error('"error" parts expect a string value.');
    }
    return { type: "error", value };
  }
};
var messageAnnotationsStreamPart = {
  code: "8",
  name: "message_annotations",
  parse: (value) => {
    if (!Array.isArray(value)) {
      throw new Error('"message_annotations" parts expect an array value.');
    }
    return { type: "message_annotations", value };
  }
};
var toolCallStreamPart = {
  code: "9",
  name: "tool_call",
  parse: (value) => {
    if (value == null || typeof value !== "object" || !("toolCallId" in value) || typeof value.toolCallId !== "string" || !("toolName" in value) || typeof value.toolName !== "string" || !("args" in value) || typeof value.args !== "object") {
      throw new Error(
        '"tool_call" parts expect an object with a "toolCallId", "toolName", and "args" property.'
      );
    }
    return {
      type: "tool_call",
      value
    };
  }
};
var toolResultStreamPart = {
  code: "a",
  name: "tool_result",
  parse: (value) => {
    if (value == null || typeof value !== "object" || !("toolCallId" in value) || typeof value.toolCallId !== "string" || !("result" in value)) {
      throw new Error(
        '"tool_result" parts expect an object with a "toolCallId" and a "result" property.'
      );
    }
    return {
      type: "tool_result",
      value
    };
  }
};
var toolCallStreamingStartStreamPart = {
  code: "b",
  name: "tool_call_streaming_start",
  parse: (value) => {
    if (value == null || typeof value !== "object" || !("toolCallId" in value) || typeof value.toolCallId !== "string" || !("toolName" in value) || typeof value.toolName !== "string") {
      throw new Error(
        '"tool_call_streaming_start" parts expect an object with a "toolCallId" and "toolName" property.'
      );
    }
    return {
      type: "tool_call_streaming_start",
      value
    };
  }
};
var toolCallDeltaStreamPart = {
  code: "c",
  name: "tool_call_delta",
  parse: (value) => {
    if (value == null || typeof value !== "object" || !("toolCallId" in value) || typeof value.toolCallId !== "string" || !("argsTextDelta" in value) || typeof value.argsTextDelta !== "string") {
      throw new Error(
        '"tool_call_delta" parts expect an object with a "toolCallId" and "argsTextDelta" property.'
      );
    }
    return {
      type: "tool_call_delta",
      value
    };
  }
};
var finishMessageStreamPart = {
  code: "d",
  name: "finish_message",
  parse: (value) => {
    if (value == null || typeof value !== "object" || !("finishReason" in value) || typeof value.finishReason !== "string") {
      throw new Error(
        '"finish_message" parts expect an object with a "finishReason" property.'
      );
    }
    const result = {
      finishReason: value.finishReason
    };
    if ("usage" in value && value.usage != null && typeof value.usage === "object" && "promptTokens" in value.usage && "completionTokens" in value.usage) {
      result.usage = {
        promptTokens: typeof value.usage.promptTokens === "number" ? value.usage.promptTokens : Number.NaN,
        completionTokens: typeof value.usage.completionTokens === "number" ? value.usage.completionTokens : Number.NaN
      };
    }
    return {
      type: "finish_message",
      value: result
    };
  }
};
var finishStepStreamPart = {
  code: "e",
  name: "finish_step",
  parse: (value) => {
    if (value == null || typeof value !== "object" || !("finishReason" in value) || typeof value.finishReason !== "string") {
      throw new Error(
        '"finish_step" parts expect an object with a "finishReason" property.'
      );
    }
    const result = {
      finishReason: value.finishReason,
      isContinued: false
    };
    if ("usage" in value && value.usage != null && typeof value.usage === "object" && "promptTokens" in value.usage && "completionTokens" in value.usage) {
      result.usage = {
        promptTokens: typeof value.usage.promptTokens === "number" ? value.usage.promptTokens : Number.NaN,
        completionTokens: typeof value.usage.completionTokens === "number" ? value.usage.completionTokens : Number.NaN
      };
    }
    if ("isContinued" in value && typeof value.isContinued === "boolean") {
      result.isContinued = value.isContinued;
    }
    return {
      type: "finish_step",
      value: result
    };
  }
};
var startStepStreamPart = {
  code: "f",
  name: "start_step",
  parse: (value) => {
    if (value == null || typeof value !== "object" || !("messageId" in value) || typeof value.messageId !== "string") {
      throw new Error(
        '"start_step" parts expect an object with an "id" property.'
      );
    }
    return {
      type: "start_step",
      value: {
        messageId: value.messageId
      }
    };
  }
};
var reasoningStreamPart = {
  code: "g",
  name: "reasoning",
  parse: (value) => {
    if (typeof value !== "string") {
      throw new Error('"reasoning" parts expect a string value.');
    }
    return { type: "reasoning", value };
  }
};
var sourcePart = {
  code: "h",
  name: "source",
  parse: (value) => {
    if (value == null || typeof value !== "object") {
      throw new Error('"source" parts expect a Source object.');
    }
    return {
      type: "source",
      value
    };
  }
};
var redactedReasoningStreamPart = {
  code: "i",
  name: "redacted_reasoning",
  parse: (value) => {
    if (value == null || typeof value !== "object" || !("data" in value) || typeof value.data !== "string") {
      throw new Error(
        '"redacted_reasoning" parts expect an object with a "data" property.'
      );
    }
    return { type: "redacted_reasoning", value: { data: value.data } };
  }
};
var reasoningSignatureStreamPart = {
  code: "j",
  name: "reasoning_signature",
  parse: (value) => {
    if (value == null || typeof value !== "object" || !("signature" in value) || typeof value.signature !== "string") {
      throw new Error(
        '"reasoning_signature" parts expect an object with a "signature" property.'
      );
    }
    return {
      type: "reasoning_signature",
      value: { signature: value.signature }
    };
  }
};
var fileStreamPart = {
  code: "k",
  name: "file",
  parse: (value) => {
    if (value == null || typeof value !== "object" || !("data" in value) || typeof value.data !== "string" || !("mimeType" in value) || typeof value.mimeType !== "string") {
      throw new Error(
        '"file" parts expect an object with a "data" and "mimeType" property.'
      );
    }
    return { type: "file", value };
  }
};
var dataStreamParts = [
  textStreamPart2,
  dataStreamPart,
  errorStreamPart2,
  messageAnnotationsStreamPart,
  toolCallStreamPart,
  toolResultStreamPart,
  toolCallStreamingStartStreamPart,
  toolCallDeltaStreamPart,
  finishMessageStreamPart,
  finishStepStreamPart,
  startStepStreamPart,
  reasoningStreamPart,
  sourcePart,
  redactedReasoningStreamPart,
  reasoningSignatureStreamPart,
  fileStreamPart
];
var dataStreamPartsByCode = Object.fromEntries(
  dataStreamParts.map((part) => [part.code, part])
);
var DataStreamStringPrefixes = Object.fromEntries(
  dataStreamParts.map((part) => [part.name, part.code])
);
var validCodes2 = dataStreamParts.map((part) => part.code);
var parseDataStreamPart = (line) => {
  const firstSeparatorIndex = line.indexOf(":");
  if (firstSeparatorIndex === -1) {
    throw new Error("Failed to parse stream string. No separator found.");
  }
  const prefix = line.slice(0, firstSeparatorIndex);
  if (!validCodes2.includes(prefix)) {
    throw new Error(`Failed to parse stream string. Invalid code ${prefix}.`);
  }
  const code = prefix;
  const textValue = line.slice(firstSeparatorIndex + 1);
  const jsonValue = JSON.parse(textValue);
  return dataStreamPartsByCode[code].parse(jsonValue);
};
function formatDataStreamPart(type, value) {
  const streamPart = dataStreamParts.find((part) => part.name === type);
  if (!streamPart) {
    throw new Error(`Invalid stream part type: ${type}`);
  }
  return `${streamPart.code}:${JSON.stringify(value)}
`;
}

// src/process-data-stream.ts
var NEWLINE = "\n".charCodeAt(0);
function concatChunks(chunks, totalLength) {
  const concatenatedChunks = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    concatenatedChunks.set(chunk, offset);
    offset += chunk.length;
  }
  chunks.length = 0;
  return concatenatedChunks;
}
async function processDataStream({
  stream,
  onTextPart,
  onReasoningPart,
  onReasoningSignaturePart,
  onRedactedReasoningPart,
  onSourcePart,
  onFilePart,
  onDataPart,
  onErrorPart,
  onToolCallStreamingStartPart,
  onToolCallDeltaPart,
  onToolCallPart,
  onToolResultPart,
  onMessageAnnotationsPart,
  onFinishMessagePart,
  onFinishStepPart,
  onStartStepPart
}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let totalLength = 0;
  while (true) {
    const { value } = await reader.read();
    if (value) {
      chunks.push(value);
      totalLength += value.length;
      if (value[value.length - 1] !== NEWLINE) {
        continue;
      }
    }
    if (chunks.length === 0) {
      break;
    }
    const concatenatedChunks = concatChunks(chunks, totalLength);
    totalLength = 0;
    const streamParts = decoder.decode(concatenatedChunks, { stream: true }).split("\n").filter((line) => line !== "").map(parseDataStreamPart);
    for (const { type, value: value2 } of streamParts) {
      switch (type) {
        case "text":
          await (onTextPart == null ? void 0 : onTextPart(value2));
          break;
        case "reasoning":
          await (onReasoningPart == null ? void 0 : onReasoningPart(value2));
          break;
        case "reasoning_signature":
          await (onReasoningSignaturePart == null ? void 0 : onReasoningSignaturePart(value2));
          break;
        case "redacted_reasoning":
          await (onRedactedReasoningPart == null ? void 0 : onRedactedReasoningPart(value2));
          break;
        case "file":
          await (onFilePart == null ? void 0 : onFilePart(value2));
          break;
        case "source":
          await (onSourcePart == null ? void 0 : onSourcePart(value2));
          break;
        case "data":
          await (onDataPart == null ? void 0 : onDataPart(value2));
          break;
        case "error":
          await (onErrorPart == null ? void 0 : onErrorPart(value2));
          break;
        case "message_annotations":
          await (onMessageAnnotationsPart == null ? void 0 : onMessageAnnotationsPart(value2));
          break;
        case "tool_call_streaming_start":
          await (onToolCallStreamingStartPart == null ? void 0 : onToolCallStreamingStartPart(value2));
          break;
        case "tool_call_delta":
          await (onToolCallDeltaPart == null ? void 0 : onToolCallDeltaPart(value2));
          break;
        case "tool_call":
          await (onToolCallPart == null ? void 0 : onToolCallPart(value2));
          break;
        case "tool_result":
          await (onToolResultPart == null ? void 0 : onToolResultPart(value2));
          break;
        case "finish_message":
          await (onFinishMessagePart == null ? void 0 : onFinishMessagePart(value2));
          break;
        case "finish_step":
          await (onFinishStepPart == null ? void 0 : onFinishStepPart(value2));
          break;
        case "start_step":
          await (onStartStepPart == null ? void 0 : onStartStepPart(value2));
          break;
        default: {
          const exhaustiveCheck = type;
          throw new Error(`Unknown stream part type: ${exhaustiveCheck}`);
        }
      }
    }
  }
}

// src/process-chat-response.ts
async function processChatResponse({
  stream,
  update,
  onToolCall,
  onFinish,
  generateId: generateId2 = import_provider_utils2.generateId,
  getCurrentDate = () => /* @__PURE__ */ new Date(),
  lastMessage
}) {
  var _a, _b;
  const replaceLastMessage = (lastMessage == null ? void 0 : lastMessage.role) === "assistant";
  let step = replaceLastMessage ? 1 + // find max step in existing tool invocations:
  ((_b = (_a = lastMessage.toolInvocations) == null ? void 0 : _a.reduce((max, toolInvocation) => {
    var _a2;
    return Math.max(max, (_a2 = toolInvocation.step) != null ? _a2 : 0);
  }, 0)) != null ? _b : 0) : 0;
  const message = replaceLastMessage ? structuredClone(lastMessage) : {
    id: generateId2(),
    createdAt: getCurrentDate(),
    role: "assistant",
    content: "",
    parts: []
  };
  let currentTextPart = void 0;
  let currentReasoningPart = void 0;
  let currentReasoningTextDetail = void 0;
  function updateToolInvocationPart(toolCallId, invocation) {
    const part = message.parts.find(
      (part2) => part2.type === "tool-invocation" && part2.toolInvocation.toolCallId === toolCallId
    );
    if (part != null) {
      part.toolInvocation = invocation;
    } else {
      message.parts.push({
        type: "tool-invocation",
        toolInvocation: invocation
      });
    }
  }
  const data = [];
  let messageAnnotations = replaceLastMessage ? lastMessage == null ? void 0 : lastMessage.annotations : void 0;
  const partialToolCalls = {};
  let usage = {
    completionTokens: NaN,
    promptTokens: NaN,
    totalTokens: NaN
  };
  let finishReason = "unknown";
  function execUpdate() {
    const copiedData = [...data];
    if (messageAnnotations == null ? void 0 : messageAnnotations.length) {
      message.annotations = messageAnnotations;
    }
    const copiedMessage = {
      // deep copy the message to ensure that deep changes (msg attachments) are updated
      // with SolidJS. SolidJS uses referential integration of sub-objects to detect changes.
      ...structuredClone(message),
      // add a revision id to ensure that the message is updated with SWR. SWR uses a
      // hashing approach by default to detect changes, but it only works for shallow
      // changes. This is why we need to add a revision id to ensure that the message
      // is updated with SWR (without it, the changes get stuck in SWR and are not
      // forwarded to rendering):
      revisionId: generateId2()
    };
    update({
      message: copiedMessage,
      data: copiedData,
      replaceLastMessage
    });
  }
  await processDataStream({
    stream,
    onTextPart(value) {
      if (currentTextPart == null) {
        currentTextPart = {
          type: "text",
          text: value
        };
        message.parts.push(currentTextPart);
      } else {
        currentTextPart.text += value;
      }
      message.content += value;
      execUpdate();
    },
    onReasoningPart(value) {
      var _a2;
      if (currentReasoningTextDetail == null) {
        currentReasoningTextDetail = { type: "text", text: value };
        if (currentReasoningPart != null) {
          currentReasoningPart.details.push(currentReasoningTextDetail);
        }
      } else {
        currentReasoningTextDetail.text += value;
      }
      if (currentReasoningPart == null) {
        currentReasoningPart = {
          type: "reasoning",
          reasoning: value,
          details: [currentReasoningTextDetail]
        };
        message.parts.push(currentReasoningPart);
      } else {
        currentReasoningPart.reasoning += value;
      }
      message.reasoning = ((_a2 = message.reasoning) != null ? _a2 : "") + value;
      execUpdate();
    },
    onReasoningSignaturePart(value) {
      if (currentReasoningTextDetail != null) {
        currentReasoningTextDetail.signature = value.signature;
      }
    },
    onRedactedReasoningPart(value) {
      if (currentReasoningPart == null) {
        currentReasoningPart = {
          type: "reasoning",
          reasoning: "",
          details: []
        };
        message.parts.push(currentReasoningPart);
      }
      currentReasoningPart.details.push({
        type: "redacted",
        data: value.data
      });
      currentReasoningTextDetail = void 0;
      execUpdate();
    },
    onFilePart(value) {
      message.parts.push({
        type: "file",
        mimeType: value.mimeType,
        data: value.data
      });
      execUpdate();
    },
    onSourcePart(value) {
      message.parts.push({
        type: "source",
        source: value
      });
      execUpdate();
    },
    onToolCallStreamingStartPart(value) {
      if (message.toolInvocations == null) {
        message.toolInvocations = [];
      }
      partialToolCalls[value.toolCallId] = {
        text: "",
        step,
        toolName: value.toolName,
        index: message.toolInvocations.length
      };
      const invocation = {
        state: "partial-call",
        step,
        toolCallId: value.toolCallId,
        toolName: value.toolName,
        args: void 0
      };
      message.toolInvocations.push(invocation);
      updateToolInvocationPart(value.toolCallId, invocation);
      execUpdate();
    },
    onToolCallDeltaPart(value) {
      const partialToolCall = partialToolCalls[value.toolCallId];
      partialToolCall.text += value.argsTextDelta;
      const { value: partialArgs } = parsePartialJson(partialToolCall.text);
      const invocation = {
        state: "partial-call",
        step: partialToolCall.step,
        toolCallId: value.toolCallId,
        toolName: partialToolCall.toolName,
        args: partialArgs
      };
      message.toolInvocations[partialToolCall.index] = invocation;
      updateToolInvocationPart(value.toolCallId, invocation);
      execUpdate();
    },
    async onToolCallPart(value) {
      const invocation = {
        state: "call",
        step,
        ...value
      };
      if (partialToolCalls[value.toolCallId] != null) {
        message.toolInvocations[partialToolCalls[value.toolCallId].index] = invocation;
      } else {
        if (message.toolInvocations == null) {
          message.toolInvocations = [];
        }
        message.toolInvocations.push(invocation);
      }
      updateToolInvocationPart(value.toolCallId, invocation);
      execUpdate();
      if (onToolCall) {
        const result = await onToolCall({ toolCall: value });
        if (result != null) {
          const invocation2 = {
            state: "result",
            step,
            ...value,
            result
          };
          message.toolInvocations[message.toolInvocations.length - 1] = invocation2;
          updateToolInvocationPart(value.toolCallId, invocation2);
          execUpdate();
        }
      }
    },
    onToolResultPart(value) {
      const toolInvocations = message.toolInvocations;
      if (toolInvocations == null) {
        throw new Error("tool_result must be preceded by a tool_call");
      }
      const toolInvocationIndex = toolInvocations.findIndex(
        (invocation2) => invocation2.toolCallId === value.toolCallId
      );
      if (toolInvocationIndex === -1) {
        throw new Error(
          "tool_result must be preceded by a tool_call with the same toolCallId"
        );
      }
      const invocation = {
        ...toolInvocations[toolInvocationIndex],
        state: "result",
        ...value
      };
      toolInvocations[toolInvocationIndex] = invocation;
      updateToolInvocationPart(value.toolCallId, invocation);
      execUpdate();
    },
    onDataPart(value) {
      data.push(...value);
      execUpdate();
    },
    onMessageAnnotationsPart(value) {
      if (messageAnnotations == null) {
        messageAnnotations = [...value];
      } else {
        messageAnnotations.push(...value);
      }
      execUpdate();
    },
    onFinishStepPart(value) {
      step += 1;
      currentTextPart = value.isContinued ? currentTextPart : void 0;
      currentReasoningPart = void 0;
      currentReasoningTextDetail = void 0;
    },
    onStartStepPart(value) {
      if (!replaceLastMessage) {
        message.id = value.messageId;
      }
      message.parts.push({ type: "step-start" });
      execUpdate();
    },
    onFinishMessagePart(value) {
      finishReason = value.finishReason;
      if (value.usage != null) {
        usage = calculateLanguageModelUsage(value.usage);
      }
    },
    onErrorPart(error) {
      throw new Error(error);
    }
  });
  onFinish == null ? void 0 : onFinish({ message, finishReason, usage });
}

// src/process-chat-text-response.ts
var import_provider_utils3 = require("@ai-sdk/provider-utils");

// src/process-text-stream.ts
async function processTextStream({
  stream,
  onTextPart
}) {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    await onTextPart(value);
  }
}

// src/process-chat-text-response.ts
async function processChatTextResponse({
  stream,
  update,
  onFinish,
  getCurrentDate = () => /* @__PURE__ */ new Date(),
  generateId: generateId2 = import_provider_utils3.generateId
}) {
  const textPart = { type: "text", text: "" };
  const resultMessage = {
    id: generateId2(),
    createdAt: getCurrentDate(),
    role: "assistant",
    content: "",
    parts: [textPart]
  };
  await processTextStream({
    stream,
    onTextPart: (chunk) => {
      resultMessage.content += chunk;
      textPart.text += chunk;
      update({
        message: { ...resultMessage },
        data: [],
        replaceLastMessage: false
      });
    }
  });
  onFinish == null ? void 0 : onFinish(resultMessage, {
    usage: { completionTokens: NaN, promptTokens: NaN, totalTokens: NaN },
    finishReason: "unknown"
  });
}

// src/call-chat-api.ts
var getOriginalFetch = () => fetch;
async function callChatApi({
  api,
  body,
  streamProtocol = "data",
  credentials,
  headers,
  abortController,
  restoreMessagesOnFailure,
  onResponse,
  onUpdate,
  onFinish,
  onToolCall,
  generateId: generateId2,
  fetch: fetch2 = getOriginalFetch(),
  lastMessage,
  requestType = "generate"
}) {
  var _a, _b, _c;
  const request = requestType === "resume" ? fetch2(`${api}?chatId=${body.id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    signal: (_a = abortController == null ? void 0 : abortController()) == null ? void 0 : _a.signal,
    credentials
  }) : fetch2(api, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    signal: (_b = abortController == null ? void 0 : abortController()) == null ? void 0 : _b.signal,
    credentials
  });
  const response = await request.catch((err) => {
    restoreMessagesOnFailure();
    throw err;
  });
  if (onResponse) {
    try {
      await onResponse(response);
    } catch (err) {
      throw err;
    }
  }
  if (!response.ok) {
    restoreMessagesOnFailure();
    throw new Error(
      (_c = await response.text()) != null ? _c : "Failed to fetch the chat response."
    );
  }
  if (!response.body) {
    throw new Error("The response body is empty.");
  }
  switch (streamProtocol) {
    case "text": {
      await processChatTextResponse({
        stream: response.body,
        update: onUpdate,
        onFinish,
        generateId: generateId2
      });
      return;
    }
    case "data": {
      await processChatResponse({
        stream: response.body,
        update: onUpdate,
        lastMessage,
        onToolCall,
        onFinish({ message, finishReason, usage }) {
          if (onFinish && message != null) {
            onFinish(message, { usage, finishReason });
          }
        },
        generateId: generateId2
      });
      return;
    }
    default: {
      const exhaustiveCheck = streamProtocol;
      throw new Error(`Unknown stream protocol: ${exhaustiveCheck}`);
    }
  }
}

// src/call-completion-api.ts
var getOriginalFetch2 = () => fetch;
async function callCompletionApi({
  api,
  prompt,
  credentials,
  headers,
  body,
  streamProtocol = "data",
  setCompletion,
  setLoading,
  setError,
  setAbortController,
  onResponse,
  onFinish,
  onError,
  onData,
  fetch: fetch2 = getOriginalFetch2()
}) {
  var _a;
  try {
    setLoading(true);
    setError(void 0);
    const abortController = new AbortController();
    setAbortController(abortController);
    setCompletion("");
    const response = await fetch2(api, {
      method: "POST",
      body: JSON.stringify({
        prompt,
        ...body
      }),
      credentials,
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      signal: abortController.signal
    }).catch((err) => {
      throw err;
    });
    if (onResponse) {
      try {
        await onResponse(response);
      } catch (err) {
        throw err;
      }
    }
    if (!response.ok) {
      throw new Error(
        (_a = await response.text()) != null ? _a : "Failed to fetch the chat response."
      );
    }
    if (!response.body) {
      throw new Error("The response body is empty.");
    }
    let result = "";
    switch (streamProtocol) {
      case "text": {
        await processTextStream({
          stream: response.body,
          onTextPart: (chunk) => {
            result += chunk;
            setCompletion(result);
          }
        });
        break;
      }
      case "data": {
        await processDataStream({
          stream: response.body,
          onTextPart(value) {
            result += value;
            setCompletion(result);
          },
          onDataPart(value) {
            onData == null ? void 0 : onData(value);
          },
          onErrorPart(value) {
            throw new Error(value);
          }
        });
        break;
      }
      default: {
        const exhaustiveCheck = streamProtocol;
        throw new Error(`Unknown stream protocol: ${exhaustiveCheck}`);
      }
    }
    if (onFinish) {
      onFinish(prompt, result);
    }
    setAbortController(null);
    return result;
  } catch (err) {
    if (err.name === "AbortError") {
      setAbortController(null);
      return null;
    }
    if (err instanceof Error) {
      if (onError) {
        onError(err);
      }
    }
    setError(err);
  } finally {
    setLoading(false);
  }
}

// src/data-url.ts
function getTextFromDataUrl(dataUrl) {
  const [header, base64Content] = dataUrl.split(",");
  const mimeType = header.split(";")[0].split(":")[1];
  if (mimeType == null || base64Content == null) {
    throw new Error("Invalid data URL format");
  }
  try {
    return window.atob(base64Content);
  } catch (error) {
    throw new Error(`Error decoding data URL`);
  }
}

// src/extract-max-tool-invocation-step.ts
function extractMaxToolInvocationStep(toolInvocations) {
  return toolInvocations == null ? void 0 : toolInvocations.reduce((max, toolInvocation) => {
    var _a;
    return Math.max(max, (_a = toolInvocation.step) != null ? _a : 0);
  }, 0);
}

// src/get-message-parts.ts
function getMessageParts(message) {
  var _a;
  return (_a = message.parts) != null ? _a : [
    ...message.toolInvocations ? message.toolInvocations.map((toolInvocation) => ({
      type: "tool-invocation",
      toolInvocation
    })) : [],
    ...message.reasoning ? [
      {
        type: "reasoning",
        reasoning: message.reasoning,
        details: [{ type: "text", text: message.reasoning }]
      }
    ] : [],
    ...message.content ? [{ type: "text", text: message.content }] : []
  ];
}

// src/fill-message-parts.ts
function fillMessageParts(messages) {
  return messages.map((message) => ({
    ...message,
    parts: getMessageParts(message)
  }));
}

// src/is-deep-equal-data.ts
function isDeepEqualData(obj1, obj2) {
  if (obj1 === obj2)
    return true;
  if (obj1 == null || obj2 == null)
    return false;
  if (typeof obj1 !== "object" && typeof obj2 !== "object")
    return obj1 === obj2;
  if (obj1.constructor !== obj2.constructor)
    return false;
  if (obj1 instanceof Date && obj2 instanceof Date) {
    return obj1.getTime() === obj2.getTime();
  }
  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length)
      return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!isDeepEqualData(obj1[i], obj2[i]))
        return false;
    }
    return true;
  }
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length)
    return false;
  for (const key of keys1) {
    if (!keys2.includes(key))
      return false;
    if (!isDeepEqualData(obj1[key], obj2[key]))
      return false;
  }
  return true;
}

// src/prepare-attachments-for-request.ts
async function prepareAttachmentsForRequest(attachmentsFromOptions) {
  if (!attachmentsFromOptions) {
    return [];
  }
  if (globalThis.FileList && attachmentsFromOptions instanceof globalThis.FileList) {
    return Promise.all(
      Array.from(attachmentsFromOptions).map(async (attachment) => {
        const { name, type } = attachment;
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (readerEvent) => {
            var _a;
            resolve((_a = readerEvent.target) == null ? void 0 : _a.result);
          };
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(attachment);
        });
        return {
          name,
          contentType: type,
          url: dataUrl
        };
      })
    );
  }
  if (Array.isArray(attachmentsFromOptions)) {
    return attachmentsFromOptions;
  }
  throw new Error("Invalid attachments type");
}

// src/process-assistant-stream.ts
var NEWLINE2 = "\n".charCodeAt(0);
function concatChunks2(chunks, totalLength) {
  const concatenatedChunks = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    concatenatedChunks.set(chunk, offset);
    offset += chunk.length;
  }
  chunks.length = 0;
  return concatenatedChunks;
}
async function processAssistantStream({
  stream,
  onTextPart,
  onErrorPart,
  onAssistantMessagePart,
  onAssistantControlDataPart,
  onDataMessagePart
}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let totalLength = 0;
  while (true) {
    const { value } = await reader.read();
    if (value) {
      chunks.push(value);
      totalLength += value.length;
      if (value[value.length - 1] !== NEWLINE2) {
        continue;
      }
    }
    if (chunks.length === 0) {
      break;
    }
    const concatenatedChunks = concatChunks2(chunks, totalLength);
    totalLength = 0;
    const streamParts = decoder.decode(concatenatedChunks, { stream: true }).split("\n").filter((line) => line !== "").map(parseAssistantStreamPart);
    for (const { type, value: value2 } of streamParts) {
      switch (type) {
        case "text":
          await (onTextPart == null ? void 0 : onTextPart(value2));
          break;
        case "error":
          await (onErrorPart == null ? void 0 : onErrorPart(value2));
          break;
        case "assistant_message":
          await (onAssistantMessagePart == null ? void 0 : onAssistantMessagePart(value2));
          break;
        case "assistant_control_data":
          await (onAssistantControlDataPart == null ? void 0 : onAssistantControlDataPart(value2));
          break;
        case "data_message":
          await (onDataMessagePart == null ? void 0 : onDataMessagePart(value2));
          break;
        default: {
          const exhaustiveCheck = type;
          throw new Error(`Unknown stream part type: ${exhaustiveCheck}`);
        }
      }
    }
  }
}

// src/schema.ts
var import_provider_utils4 = require("@ai-sdk/provider-utils");

// src/zod-schema.ts
var import_zod_to_json_schema = __toESM(require("zod-to-json-schema"));
function zodSchema(zodSchema2, options) {
  var _a;
  const useReferences = (_a = options == null ? void 0 : options.useReferences) != null ? _a : false;
  return jsonSchema(
    (0, import_zod_to_json_schema.default)(zodSchema2, {
      $refStrategy: useReferences ? "root" : "none",
      target: "jsonSchema7"
      // note: openai mode breaks various gemini conversions
    }),
    {
      validate: (value) => {
        const result = zodSchema2.safeParse(value);
        return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
      }
    }
  );
}

// src/schema.ts
var schemaSymbol = Symbol.for("vercel.ai.schema");
function jsonSchema(jsonSchema2, {
  validate
} = {}) {
  return {
    [schemaSymbol]: true,
    _type: void 0,
    // should never be used directly
    [import_provider_utils4.validatorSymbol]: true,
    jsonSchema: jsonSchema2,
    validate
  };
}
function isSchema(value) {
  return typeof value === "object" && value !== null && schemaSymbol in value && value[schemaSymbol] === true && "jsonSchema" in value && "validate" in value;
}
function asSchema(schema) {
  return isSchema(schema) ? schema : zodSchema(schema);
}

// src/should-resubmit-messages.ts
function shouldResubmitMessages({
  originalMaxToolInvocationStep,
  originalMessageCount,
  maxSteps,
  messages
}) {
  var _a;
  const lastMessage = messages[messages.length - 1];
  return (
    // check if the feature is enabled:
    maxSteps > 1 && // ensure there is a last message:
    lastMessage != null && // ensure we actually have new steps (to prevent infinite loops in case of errors):
    (messages.length > originalMessageCount || extractMaxToolInvocationStep(lastMessage.toolInvocations) !== originalMaxToolInvocationStep) && // check that next step is possible:
    isAssistantMessageWithCompletedToolCalls(lastMessage) && // limit the number of automatic steps:
    ((_a = extractMaxToolInvocationStep(lastMessage.toolInvocations)) != null ? _a : 0) < maxSteps
  );
}
function isAssistantMessageWithCompletedToolCalls(message) {
  if (message.role !== "assistant") {
    return false;
  }
  const lastStepStartIndex = message.parts.reduce((lastIndex, part, index) => {
    return part.type === "step-start" ? index : lastIndex;
  }, -1);
  const lastStepToolInvocations = message.parts.slice(lastStepStartIndex + 1).filter((part) => part.type === "tool-invocation");
  return lastStepToolInvocations.length > 0 && lastStepToolInvocations.every((part) => "result" in part.toolInvocation);
}

// src/update-tool-call-result.ts
function updateToolCallResult({
  messages,
  toolCallId,
  toolResult: result
}) {
  var _a;
  const lastMessage = messages[messages.length - 1];
  const invocationPart = lastMessage.parts.find(
    (part) => part.type === "tool-invocation" && part.toolInvocation.toolCallId === toolCallId
  );
  if (invocationPart == null) {
    return;
  }
  const toolResult = {
    ...invocationPart.toolInvocation,
    state: "result",
    result
  };
  invocationPart.toolInvocation = toolResult;
  lastMessage.toolInvocations = (_a = lastMessage.toolInvocations) == null ? void 0 : _a.map(
    (toolInvocation) => toolInvocation.toolCallId === toolCallId ? toolResult : toolInvocation
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  asSchema,
  callChatApi,
  callCompletionApi,
  extractMaxToolInvocationStep,
  fillMessageParts,
  formatAssistantStreamPart,
  formatDataStreamPart,
  generateId,
  getMessageParts,
  getTextFromDataUrl,
  isAssistantMessageWithCompletedToolCalls,
  isDeepEqualData,
  jsonSchema,
  parseAssistantStreamPart,
  parseDataStreamPart,
  parsePartialJson,
  prepareAttachmentsForRequest,
  processAssistantStream,
  processDataStream,
  processTextStream,
  shouldResubmitMessages,
  updateToolCallResult,
  zodSchema
});
//# sourceMappingURL=index.js.map