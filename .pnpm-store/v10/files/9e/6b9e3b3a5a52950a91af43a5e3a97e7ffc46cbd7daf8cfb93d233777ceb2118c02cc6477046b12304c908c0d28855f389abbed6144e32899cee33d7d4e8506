import type { Attributes } from "@opentelemetry/api";
import {
  OpenInferenceSpanKind,
  SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";
import {
  ATTR_GEN_AI_PROVIDER_NAME,
  ATTR_GEN_AI_REQUEST_MODEL,
  ATTR_GEN_AI_RESPONSE_MODEL,
  ATTR_GEN_AI_REQUEST_MAX_TOKENS,
  ATTR_GEN_AI_REQUEST_TEMPERATURE,
  ATTR_GEN_AI_REQUEST_TOP_P,
  ATTR_GEN_AI_REQUEST_TOP_K,
  ATTR_GEN_AI_REQUEST_PRESENCE_PENALTY,
  ATTR_GEN_AI_REQUEST_FREQUENCY_PENALTY,
  ATTR_GEN_AI_REQUEST_STOP_SEQUENCES,
  ATTR_GEN_AI_REQUEST_SEED,
  ATTR_GEN_AI_INPUT_MESSAGES,
  ATTR_GEN_AI_OUTPUT_MESSAGES,
  ATTR_GEN_AI_USAGE_INPUT_TOKENS,
  ATTR_GEN_AI_USAGE_OUTPUT_TOKENS,
  ATTR_GEN_AI_PROMPT,
  ATTR_GEN_AI_COMPLETION,
  ATTR_GEN_AI_AGENT_ID,
  ATTR_GEN_AI_AGENT_NAME,
  ATTR_GEN_AI_AGENT_DESCRIPTION,
  ATTR_GEN_AI_TOOL_NAME,
  ATTR_GEN_AI_TOOL_DESCRIPTION,
  ATTR_GEN_AI_TOOL_CALL_ID,
  ATTR_GEN_AI_TOOL_TYPE,
} from "@opentelemetry/semantic-conventions/incubating";

import {
  getMimeType,
  getNumber,
  getString,
  getStringArray,
  merge,
  safelyParseJSON,
  safelyJSONStringify,
  set,
  toStringContent,
} from "./utils.js";
import type {
  ChatMessage,
  GenericPart,
} from "./__generated__/opentelemetryInputMessages.js";
import type { OutputMessage } from "./__generated__/opentelemetryOutputMessages.js";

export type GenAIInputMessage = ChatMessage;
export type GenAIInputMessagePart = ChatMessage["parts"][number];
export type GenAIOutputMessage = OutputMessage & {
  /** @deprecated use parts instead */
  text?: string;
};
export type GenAIOutputMessagePart = OutputMessage["parts"][number];

const AGENT_KIND_PREFIXES = [
  ATTR_GEN_AI_AGENT_ID,
  ATTR_GEN_AI_AGENT_NAME,
  ATTR_GEN_AI_AGENT_DESCRIPTION,
] as const;

const TOOL_EXECUTION_PREFIXES = [
  ATTR_GEN_AI_TOOL_NAME,
  ATTR_GEN_AI_TOOL_DESCRIPTION,
  ATTR_GEN_AI_TOOL_CALL_ID,
  ATTR_GEN_AI_TOOL_TYPE,
] as const;

// Shared part parsing
type AnyPart = GenAIInputMessagePart | GenAIOutputMessagePart;

/**
 * Type guard for a GenAI chat message
 * @param value - The value to check
 * @returns True if the value is a chat message, false otherwise
 */
const isGenAIChatMessage = (value: unknown): value is ChatMessage => {
  if (typeof value !== "object" || value === null) return false;
  if (!("role" in value) || !("parts" in value)) return false;
  if (typeof value.role !== "string" || !Array.isArray(value.parts))
    return false;
  if (!value.parts || !Array.isArray(value.parts)) return false;
  return true;
};

/**
 * Process genai message parts into openinference attributes
 *
 * @param params - The parameters to process the message parts
 */
const processMessageParts = ({
  attrs,
  msgPrefix,
  parts,
}: {
  /** The attributes to mutate with new message attributes */
  attrs: Attributes;
  /** The prefix to add to the attributes */
  msgPrefix: string;
  /** The parts to process */
  parts: AnyPart[] | undefined;
}): void => {
  if (!Array.isArray(parts) || parts.length === 0) return;

  // track the index of the content and tool calls outside the loop
  // this is just in-case we have to skip bad parts
  let contentIndex = 0;
  let toolIndex = 0;

  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    if (!part.type) continue;

    switch (part.type) {
      case "text": {
        const text = toStringContent(part.content);
        if (text !== undefined) {
          // MESSAGE_CONTENTS entries
          const contentPrefix = `${msgPrefix}${SemanticConventions.MESSAGE_CONTENTS}.${contentIndex}.`;
          set(
            attrs,
            `${contentPrefix}${SemanticConventions.MESSAGE_CONTENT_TYPE}`,
            "text",
          );
          set(
            attrs,
            `${contentPrefix}${SemanticConventions.MESSAGE_CONTENT_TEXT}`,
            text,
          );
          contentIndex += 1;
        }
        continue;
      }
      case "tool_call": {
        const id = part.id ?? undefined;
        const name = part.name;
        const args = part.arguments ?? {};
        const toolPrefix = `${msgPrefix}${SemanticConventions.MESSAGE_TOOL_CALLS}.${toolIndex}.`;
        set(attrs, `${toolPrefix}${SemanticConventions.TOOL_CALL_ID}`, id);
        set(
          attrs,
          toolPrefix + SemanticConventions.TOOL_CALL_FUNCTION_NAME,
          name,
        );
        set(
          attrs,
          toolPrefix + SemanticConventions.TOOL_CALL_FUNCTION_ARGUMENTS_JSON,
          safelyJSONStringify(args),
        );
        toolIndex += 1;
        continue;
      }
      case "tool_call_response": {
        const id = part.id ?? undefined;
        const response = toStringContent(part.response);

        set(
          attrs,
          `${msgPrefix}${SemanticConventions.MESSAGE_TOOL_CALL_ID}`,
          id,
        );
        const contentPrefix = `${msgPrefix}${SemanticConventions.MESSAGE_CONTENTS}.${contentIndex}.`;
        set(
          attrs,
          `${contentPrefix}${SemanticConventions.MESSAGE_CONTENT_TYPE}`,
          "text",
        );
        set(
          attrs,
          `${contentPrefix}${SemanticConventions.MESSAGE_CONTENT_TEXT}`,
          response,
        );
        contentIndex += 1;
        continue;
      }
      default: {
        // Generic / unknown part type: capture as JSON text content
        const genericPart = part as GenericPart;
        const genericText = toStringContent(genericPart);
        const contentPrefix = `${msgPrefix}${SemanticConventions.MESSAGE_CONTENTS}.${contentIndex}.`;
        set(
          attrs,
          `${contentPrefix}${SemanticConventions.MESSAGE_CONTENT_TYPE}`,
          genericPart.type,
        );
        set(
          attrs,
          `${contentPrefix}${SemanticConventions.MESSAGE_CONTENT_TEXT}`,
          genericText,
        );
        set(
          attrs,
          `${msgPrefix}${SemanticConventions.MESSAGE_CONTENT}`,
          genericText,
        );
        contentIndex += 1;
      }
    }
  }
};

/**
 * Convert GenAI span attributes to OpenInference span attributes
 * @param spanAttributes - The span attributes containing GenAI span attributes to convert
 * @returns The converted OpenInference span attributes
 */
export const convertGenAISpanAttributesToOpenInferenceSpanAttributes = (
  spanAttributes: Attributes,
): Attributes => {
  return merge(
    mapProviderAndSystem(spanAttributes),
    mapModels(spanAttributes),
    mapSpanKind(spanAttributes),
    mapInvocationParameters(spanAttributes),
    mapInputMessages(spanAttributes),
    mapOutputMessages(spanAttributes),
    mapTokenCounts(spanAttributes),
    mapToolExecution(spanAttributes),
    mapInputValue(spanAttributes),
    mapOutputValue(spanAttributes),
  );
};

/**
 * Map provider and system to openinference attributes
 * @todo add some heuristics that can map incoming provider names to the correct OpenInference provider name
 * @param spanAttributes - The span attributes containing provider and system to map
 * @returns The mapped provider and system attributes
 */
export const mapProviderAndSystem = (
  spanAttributes: Attributes,
): Attributes => {
  const attrs: Attributes = {};
  const provider = getString(spanAttributes[ATTR_GEN_AI_PROVIDER_NAME]);
  set(attrs, SemanticConventions.LLM_PROVIDER, provider);
  return attrs;
};

/**
 * Map model name to openinference attributes
 * @param spanAttributes - The span attributes containing model name to map
 * @returns The mapped model name attributes
 */
export const mapModels = (spanAttributes: Attributes): Attributes => {
  const attrs: Attributes = {};
  const requestModel = getString(spanAttributes[ATTR_GEN_AI_REQUEST_MODEL]);
  const responseModel = getString(spanAttributes[ATTR_GEN_AI_RESPONSE_MODEL]);
  const modelName = responseModel ?? requestModel;
  set(attrs, SemanticConventions.LLM_MODEL_NAME, modelName);
  return attrs;
};

/**
 * Map span kind to openinference attributes
 * @param spanAttributes - The span attributes containing span kind to map
 * @returns The mapped span kind attributes
 */
export const mapSpanKind = (spanAttributes: Attributes): Attributes => {
  const attrs: Attributes = {};
  // default to LLM for now
  let spanKind = OpenInferenceSpanKind.LLM;
  // detect agent kind
  if (AGENT_KIND_PREFIXES.some((prefix) => spanAttributes[prefix])) {
    spanKind = OpenInferenceSpanKind.AGENT;
  }
  // detect tool execution kind
  if (TOOL_EXECUTION_PREFIXES.some((prefix) => spanAttributes[prefix])) {
    spanKind = OpenInferenceSpanKind.TOOL;
  }

  set(attrs, SemanticConventions.OPENINFERENCE_SPAN_KIND, spanKind);

  return attrs;
};

/**
 * Map invocation parameters to openinference attributes
 * @param spanAttributes - The span attributes containing invocation parameters to map
 * @returns The mapped invocation parameters attributes
 */
export const mapInvocationParameters = (
  spanAttributes: Attributes,
): Attributes => {
  const attrs: Attributes = {};
  const requestModel = getString(spanAttributes[ATTR_GEN_AI_REQUEST_MODEL]);
  const maxTokens = getNumber(spanAttributes[ATTR_GEN_AI_REQUEST_MAX_TOKENS]);
  const temperature = getNumber(
    spanAttributes[ATTR_GEN_AI_REQUEST_TEMPERATURE],
  );
  const topP = getNumber(spanAttributes[ATTR_GEN_AI_REQUEST_TOP_P]);
  const topK = getNumber(spanAttributes[ATTR_GEN_AI_REQUEST_TOP_K]);
  const presencePenalty = getNumber(
    spanAttributes[ATTR_GEN_AI_REQUEST_PRESENCE_PENALTY],
  );
  const frequencyPenalty = getNumber(
    spanAttributes[ATTR_GEN_AI_REQUEST_FREQUENCY_PENALTY],
  );
  const seed = getNumber(spanAttributes[ATTR_GEN_AI_REQUEST_SEED]);
  const stopSequences = getStringArray(
    spanAttributes[ATTR_GEN_AI_REQUEST_STOP_SEQUENCES],
  );
  const invocationParameters: Record<string, unknown> = {};
  if (requestModel) invocationParameters.model = requestModel;
  if (typeof temperature === "number")
    invocationParameters.temperature = temperature;
  if (typeof topP === "number") invocationParameters.top_p = topP;
  if (typeof topK === "number") invocationParameters.top_k = topK;
  if (typeof presencePenalty === "number")
    invocationParameters.presence_penalty = presencePenalty;
  if (typeof frequencyPenalty === "number")
    invocationParameters.frequency_penalty = frequencyPenalty;
  if (typeof seed === "number") invocationParameters.seed = seed;
  if (stopSequences && stopSequences.length > 0)
    invocationParameters.stop_sequences = stopSequences;
  if (typeof maxTokens === "number")
    invocationParameters.max_completion_tokens = maxTokens;
  if (Object.keys(invocationParameters).length > 0) {
    set(
      attrs,
      SemanticConventions.LLM_INVOCATION_PARAMETERS,
      safelyJSONStringify(invocationParameters),
    );
  }
  return attrs;
};

/**
 * Map input value to openinference attributes
 * @param spanAttributes - The span attributes containing input value to map
 * @returns The mapped input value attributes
 */
export const mapInputValue = (spanAttributes: Attributes): Attributes => {
  const attrs: Attributes = {};
  let input = getString(spanAttributes["input"]);
  if (!input) {
    // fallback to deprecated prompt attribute if input is not present
    input = getString(spanAttributes[ATTR_GEN_AI_PROMPT]);
  }
  // only set input value and mime type if input is present
  if (input) {
    set(attrs, SemanticConventions.INPUT_VALUE, input);
    set(attrs, SemanticConventions.INPUT_MIME_TYPE, getMimeType(input));
  }
  return attrs;
};

/**
 * Map output value to openinference attributes
 * @param spanAttributes - The span attributes containing output value to map
 * @returns The mapped output value attributes
 */
export const mapOutputValue = (spanAttributes: Attributes): Attributes => {
  const attrs: Attributes = {};
  let output = getString(spanAttributes["output"]);
  if (!output) {
    // fallback to deprecated completion attribute if output is not present
    output = getString(spanAttributes[ATTR_GEN_AI_COMPLETION]);
  }
  // only set output value and mime type if output is present
  if (output) {
    set(attrs, SemanticConventions.OUTPUT_VALUE, output);
    set(attrs, SemanticConventions.OUTPUT_MIME_TYPE, getMimeType(output));
  }
  return attrs;
};

/**
 * Map input messages to openinference attributes
 * @param spanAttributes - The span attributes containing input messages to map
 * @returns The mapped input messages attributes
 */
export const mapInputMessages = (spanAttributes: Attributes): Attributes => {
  const attrs: Attributes = {};
  const genAIInputMessages = safelyParseJSON(
    spanAttributes[ATTR_GEN_AI_INPUT_MESSAGES],
  );

  if (Array.isArray(genAIInputMessages)) {
    (genAIInputMessages as unknown[]).forEach((msg, msgIndex) => {
      if (!isGenAIChatMessage(msg)) return;
      const msgPrefix = `${SemanticConventions.LLM_INPUT_MESSAGES}.${msgIndex}.`;
      // set the message role
      set(attrs, `${msgPrefix}${SemanticConventions.MESSAGE_ROLE}`, msg.role);
      // process and set the rest of the message parts
      processMessageParts({ attrs, msgPrefix, parts: msg.parts });
    });
  }

  return attrs;
};

/**
 * Map output messages to openinference attributes
 * @param spanAttributes - The span attributes containing output messages to map
 * @returns The mapped output messages attributes
 */
export const mapOutputMessages = (spanAttributes: Attributes): Attributes => {
  const attrs: Attributes = {};
  const genAIOutputMessages = safelyParseJSON(
    spanAttributes[ATTR_GEN_AI_OUTPUT_MESSAGES],
  );

  if (Array.isArray(genAIOutputMessages) && genAIOutputMessages.length > 0) {
    // recast as unknown[] for safety, as Array.isArray() retypes to any[]
    (genAIOutputMessages as unknown[]).forEach((msg, msgIndex) => {
      if (!isGenAIChatMessage(msg)) return;
      const msgPrefix = `${SemanticConventions.LLM_OUTPUT_MESSAGES}.${msgIndex}.`;
      // set the message role
      set(attrs, `${msgPrefix}${SemanticConventions.MESSAGE_ROLE}`, msg.role);
      // process and set the rest of the message parts
      processMessageParts({ attrs, msgPrefix, parts: msg.parts });
    });
  }

  return attrs;
};

/**
 * Map usage token counts to openinference attributes
 * @param spanAttributes - The span attributes containing usage token counts to map
 * @returns The mapped usage token counts attributes
 */
export const mapTokenCounts = (spanAttributes: Attributes): Attributes => {
  const attrs: Attributes = {};
  const inputTokens = getNumber(spanAttributes[ATTR_GEN_AI_USAGE_INPUT_TOKENS]);
  const outputTokens = getNumber(
    spanAttributes[ATTR_GEN_AI_USAGE_OUTPUT_TOKENS],
  );
  if (typeof inputTokens === "number") {
    set(attrs, SemanticConventions.LLM_TOKEN_COUNT_PROMPT, inputTokens);
  }
  if (typeof outputTokens === "number") {
    set(attrs, SemanticConventions.LLM_TOKEN_COUNT_COMPLETION, outputTokens);
  }
  if (typeof inputTokens === "number" && typeof outputTokens === "number") {
    set(
      attrs,
      SemanticConventions.LLM_TOKEN_COUNT_TOTAL,
      inputTokens + outputTokens,
    );
  }
  return attrs;
};

/**
 * Map tool execution to openinference attributes
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/#execute-tool-span
 * @param spanAttributes - The span attributes containing tool execution to map
 * @returns The mapped tool execution attributes
 */
export const mapToolExecution = (spanAttributes: Attributes): Attributes => {
  const attrs: Attributes = {};
  const toolName = getString(spanAttributes[ATTR_GEN_AI_TOOL_NAME]);
  const toolDescription = getString(
    spanAttributes[ATTR_GEN_AI_TOOL_DESCRIPTION],
  );
  const toolCallId = getString(spanAttributes[ATTR_GEN_AI_TOOL_CALL_ID]);
  // parse supported tool details
  // note: while openinference can track parameters, gen_ai does not provide this information
  set(attrs, SemanticConventions.TOOL_NAME, toolName);
  set(attrs, SemanticConventions.TOOL_DESCRIPTION, toolDescription);
  set(attrs, SemanticConventions.TOOL_CALL_ID, toolCallId);

  return attrs;
};
