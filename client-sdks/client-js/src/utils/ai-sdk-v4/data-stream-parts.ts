// Vendored from @ai-sdk/ui-utils@1.2.11 (Apache-2.0, Copyright Vercel, Inc.) to avoid depending on
// @ai-sdk/provider-utils@2.x (GHSA-866g-f22w-33x8). Only the v4 data stream protocol pieces used by this package.
import type { FinishReason, JSONValue, Source, ToolCall, ToolResult } from './types';

export type DataStreamString =
  `${(typeof DataStreamStringPrefixes)[keyof typeof DataStreamStringPrefixes]}:${string}\n`;

export interface DataStreamPart<CODE extends string, NAME extends string, TYPE> {
  code: CODE;
  name: NAME;
  parse: (value: JSONValue) => { type: NAME; value: TYPE };
}

const textStreamPart: DataStreamPart<'0', 'text', string> = {
  code: '0',
  name: 'text',
  parse: (value: JSONValue) => {
    if (typeof value !== 'string') {
      throw new Error('"text" parts expect a string value.');
    }
    return { type: 'text', value };
  },
};

const dataStreamPart: DataStreamPart<'2', 'data', Array<JSONValue>> = {
  code: '2',
  name: 'data',
  parse: (value: JSONValue) => {
    if (!Array.isArray(value)) {
      throw new Error('"data" parts expect an array value.');
    }

    return { type: 'data', value };
  },
};

const errorStreamPart: DataStreamPart<'3', 'error', string> = {
  code: '3',
  name: 'error',
  parse: (value: JSONValue) => {
    if (typeof value !== 'string') {
      throw new Error('"error" parts expect a string value.');
    }
    return { type: 'error', value };
  },
};

const messageAnnotationsStreamPart: DataStreamPart<'8', 'message_annotations', Array<JSONValue>> = {
  code: '8',
  name: 'message_annotations',
  parse: (value: JSONValue) => {
    if (!Array.isArray(value)) {
      throw new Error('"message_annotations" parts expect an array value.');
    }

    return { type: 'message_annotations', value };
  },
};

const toolCallStreamPart: DataStreamPart<'9', 'tool_call', ToolCall<string, any>> = {
  code: '9',
  name: 'tool_call',
  parse: (value: JSONValue) => {
    if (
      value == null ||
      typeof value !== 'object' ||
      !('toolCallId' in value) ||
      typeof value.toolCallId !== 'string' ||
      !('toolName' in value) ||
      typeof value.toolName !== 'string' ||
      !('args' in value) ||
      typeof value.args !== 'object'
    ) {
      throw new Error('"tool_call" parts expect an object with a "toolCallId", "toolName", and "args" property.');
    }

    return {
      type: 'tool_call',
      value: value as unknown as ToolCall<string, any>,
    };
  },
};

const toolResultStreamPart: DataStreamPart<
  'a',
  'tool_result',
  Omit<ToolResult<string, any, any>, 'args' | 'toolName'>
> = {
  code: 'a',
  name: 'tool_result',
  parse: (value: JSONValue) => {
    if (
      value == null ||
      typeof value !== 'object' ||
      !('toolCallId' in value) ||
      typeof value.toolCallId !== 'string' ||
      !('result' in value)
    ) {
      throw new Error('"tool_result" parts expect an object with a "toolCallId" and a "result" property.');
    }

    return {
      type: 'tool_result',
      value: value as unknown as Omit<ToolResult<string, any, any>, 'args' | 'toolName'>,
    };
  },
};

const toolCallStreamingStartStreamPart: DataStreamPart<
  'b',
  'tool_call_streaming_start',
  { toolCallId: string; toolName: string }
> = {
  code: 'b',
  name: 'tool_call_streaming_start',
  parse: (value: JSONValue) => {
    if (
      value == null ||
      typeof value !== 'object' ||
      !('toolCallId' in value) ||
      typeof value.toolCallId !== 'string' ||
      !('toolName' in value) ||
      typeof value.toolName !== 'string'
    ) {
      throw new Error(
        '"tool_call_streaming_start" parts expect an object with a "toolCallId" and "toolName" property.',
      );
    }

    return {
      type: 'tool_call_streaming_start',
      value: value as unknown as { toolCallId: string; toolName: string },
    };
  },
};

const toolCallDeltaStreamPart: DataStreamPart<'c', 'tool_call_delta', { toolCallId: string; argsTextDelta: string }> = {
  code: 'c',
  name: 'tool_call_delta',
  parse: (value: JSONValue) => {
    if (
      value == null ||
      typeof value !== 'object' ||
      !('toolCallId' in value) ||
      typeof value.toolCallId !== 'string' ||
      !('argsTextDelta' in value) ||
      typeof value.argsTextDelta !== 'string'
    ) {
      throw new Error('"tool_call_delta" parts expect an object with a "toolCallId" and "argsTextDelta" property.');
    }

    return {
      type: 'tool_call_delta',
      value: value as unknown as {
        toolCallId: string;
        argsTextDelta: string;
      },
    };
  },
};

const finishMessageStreamPart: DataStreamPart<
  'd',
  'finish_message',
  {
    finishReason: FinishReason;
    // TODO v5 remove usage from finish event (only on step-finish)
    usage?: {
      promptTokens: number;
      completionTokens: number;
    };
  }
> = {
  code: 'd',
  name: 'finish_message',
  parse: (value: JSONValue) => {
    if (
      value == null ||
      typeof value !== 'object' ||
      !('finishReason' in value) ||
      typeof value.finishReason !== 'string'
    ) {
      throw new Error('"finish_message" parts expect an object with a "finishReason" property.');
    }

    const result: {
      finishReason: FinishReason;
      usage?: {
        promptTokens: number;
        completionTokens: number;
      };
    } = {
      finishReason: value.finishReason as FinishReason,
    };

    if (
      'usage' in value &&
      value.usage != null &&
      typeof value.usage === 'object' &&
      'promptTokens' in value.usage &&
      'completionTokens' in value.usage
    ) {
      result.usage = {
        promptTokens: typeof value.usage.promptTokens === 'number' ? value.usage.promptTokens : Number.NaN,
        completionTokens: typeof value.usage.completionTokens === 'number' ? value.usage.completionTokens : Number.NaN,
      };
    }

    return {
      type: 'finish_message',
      value: result,
    };
  },
};

const finishStepStreamPart: DataStreamPart<
  'e',
  'finish_step',
  {
    isContinued: boolean;
    finishReason: FinishReason;
    usage?: {
      promptTokens: number;
      completionTokens: number;
    };
  }
> = {
  code: 'e',
  name: 'finish_step',
  parse: (value: JSONValue) => {
    if (
      value == null ||
      typeof value !== 'object' ||
      !('finishReason' in value) ||
      typeof value.finishReason !== 'string'
    ) {
      throw new Error('"finish_step" parts expect an object with a "finishReason" property.');
    }

    const result: {
      isContinued: boolean;
      finishReason: FinishReason;
      usage?: {
        promptTokens: number;
        completionTokens: number;
      };
    } = {
      finishReason: value.finishReason as FinishReason,
      isContinued: false,
    };

    if (
      'usage' in value &&
      value.usage != null &&
      typeof value.usage === 'object' &&
      'promptTokens' in value.usage &&
      'completionTokens' in value.usage
    ) {
      result.usage = {
        promptTokens: typeof value.usage.promptTokens === 'number' ? value.usage.promptTokens : Number.NaN,
        completionTokens: typeof value.usage.completionTokens === 'number' ? value.usage.completionTokens : Number.NaN,
      };
    }

    if ('isContinued' in value && typeof value.isContinued === 'boolean') {
      result.isContinued = value.isContinued;
    }

    return {
      type: 'finish_step',
      value: result,
    };
  },
};

const startStepStreamPart: DataStreamPart<
  'f',
  'start_step',
  {
    messageId: string;
  }
> = {
  code: 'f',
  name: 'start_step',
  parse: (value: JSONValue) => {
    if (value == null || typeof value !== 'object' || !('messageId' in value) || typeof value.messageId !== 'string') {
      throw new Error('"start_step" parts expect an object with an "id" property.');
    }

    return {
      type: 'start_step',
      value: {
        messageId: value.messageId,
      },
    };
  },
};

const reasoningStreamPart: DataStreamPart<'g', 'reasoning', string> = {
  code: 'g',
  name: 'reasoning',
  parse: (value: JSONValue) => {
    if (typeof value !== 'string') {
      throw new Error('"reasoning" parts expect a string value.');
    }
    return { type: 'reasoning', value };
  },
};

const sourcePart: DataStreamPart<'h', 'source', Source> = {
  code: 'h',
  name: 'source',
  parse: (value: JSONValue) => {
    if (value == null || typeof value !== 'object') {
      throw new Error('"source" parts expect a Source object.');
    }

    return {
      type: 'source',
      value: value as Source,
    };
  },
};

const redactedReasoningStreamPart: DataStreamPart<'i', 'redacted_reasoning', { data: string }> = {
  code: 'i',
  name: 'redacted_reasoning',
  parse: (value: JSONValue) => {
    if (value == null || typeof value !== 'object' || !('data' in value) || typeof value.data !== 'string') {
      throw new Error('"redacted_reasoning" parts expect an object with a "data" property.');
    }
    return { type: 'redacted_reasoning', value: { data: value.data } };
  },
};

const reasoningSignatureStreamPart: DataStreamPart<'j', 'reasoning_signature', { signature: string }> = {
  code: 'j',
  name: 'reasoning_signature',
  parse: (value: JSONValue) => {
    if (value == null || typeof value !== 'object' || !('signature' in value) || typeof value.signature !== 'string') {
      throw new Error('"reasoning_signature" parts expect an object with a "signature" property.');
    }
    return {
      type: 'reasoning_signature',
      value: { signature: value.signature },
    };
  },
};

const fileStreamPart: DataStreamPart<
  'k',
  'file',
  {
    data: string; // base64 encoded data
    mimeType: string;
  }
> = {
  code: 'k',
  name: 'file',
  parse: (value: JSONValue) => {
    if (
      value == null ||
      typeof value !== 'object' ||
      !('data' in value) ||
      typeof value.data !== 'string' ||
      !('mimeType' in value) ||
      typeof value.mimeType !== 'string'
    ) {
      throw new Error('"file" parts expect an object with a "data" and "mimeType" property.');
    }
    return { type: 'file', value: value as { data: string; mimeType: string } };
  },
};

const dataStreamParts = [
  textStreamPart,
  dataStreamPart,
  errorStreamPart,
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
  fileStreamPart,
] as const;

export const dataStreamPartsByCode = Object.fromEntries(dataStreamParts.map(part => [part.code, part])) as {
  [K in (typeof dataStreamParts)[number]['code']]: (typeof dataStreamParts)[number];
};

type DataStreamParts = (typeof dataStreamParts)[number];

/**
 * Maps the type of a stream part to its value type.
 */
type DataStreamPartValueType = {
  [P in DataStreamParts as P['name']]: ReturnType<P['parse']>['value'];
};

export type DataStreamPartType = ReturnType<DataStreamParts['parse']>;

/**
 * The map of prefixes for data in the stream
 *
 * - 0: Text from the LLM response
 * - 1: (OpenAI) function_call responses
 * - 2: custom JSON added by the user using `Data`
 * - 6: (OpenAI) tool_call responses
 *
 * Example:
 * ```
 * 0:Vercel
 * 0:'s
 * 0: AI
 * 0: AI
 * 0: SDK
 * 0: is great
 * 0:!
 * 2: { "someJson": "value" }
 * 1: {"function_call": {"name": "get_current_weather", "arguments": "{\\n\\"location\\": \\"Charlottesville, Virginia\\",\\n\\"format\\": \\"celsius\\"\\n}"}}
 * 6: {"tool_call": {"id": "tool_0", "type": "function", "function": {"name": "get_current_weather", "arguments": "{\\n\\"location\\": \\"Charlottesville, Virginia\\",\\n\\"format\\": \\"celsius\\"\\n}"}}}
 *```
 */
export const DataStreamStringPrefixes = Object.fromEntries(dataStreamParts.map(part => [part.name, part.code])) as {
  [K in DataStreamParts['name']]: (typeof dataStreamParts)[number]['code'];
};

export const validCodes = dataStreamParts.map(part => part.code);

/**
Parses a stream part from a string.

@param line The string to parse.
@returns The parsed stream part.
@throws An error if the string cannot be parsed.
 */
export const parseDataStreamPart = (line: string): DataStreamPartType => {
  const firstSeparatorIndex = line.indexOf(':');

  if (firstSeparatorIndex === -1) {
    throw new Error('Failed to parse stream string. No separator found.');
  }

  const prefix = line.slice(0, firstSeparatorIndex);

  if (!validCodes.includes(prefix as keyof typeof dataStreamPartsByCode)) {
    throw new Error(`Failed to parse stream string. Invalid code ${prefix}.`);
  }

  const code = prefix as keyof typeof dataStreamPartsByCode;

  const textValue = line.slice(firstSeparatorIndex + 1);
  const jsonValue: JSONValue = JSON.parse(textValue);

  return dataStreamPartsByCode[code].parse(jsonValue);
};

/**
Prepends a string with a prefix from the `StreamChunkPrefixes`, JSON-ifies it,
and appends a new line.

It ensures type-safety for the part type and value.
 */
export function formatDataStreamPart<T extends keyof DataStreamPartValueType>(
  type: T,
  value: DataStreamPartValueType[T],
): DataStreamString {
  const streamPart = dataStreamParts.find(part => part.name === type);

  if (!streamPart) {
    throw new Error(`Invalid stream part type: ${type}`);
  }

  return `${streamPart.code}:${JSON.stringify(value)}\n`;
}
