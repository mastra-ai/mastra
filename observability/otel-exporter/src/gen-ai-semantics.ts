/**
 * Utilities for converting Mastra Spans to OTel Spans
 * with Semantic conventions for generative AI systems
 * @see https://github.com/open-telemetry/semantic-conventions/blob/v1.38.0/docs/gen-ai/README.md
 * @see https://github.com/open-telemetry/semantic-conventions/blob/v1.38.0/docs/gen-ai/gen-ai-events.md
 * @see https://github.com/open-telemetry/semantic-conventions/blob/v1.38.0/docs/gen-ai/gen-ai-spans.md
 * @see https://github.com/open-telemetry/semantic-conventions/blob/v1.38.0/docs/gen-ai/gen-ai-agent-spans.md
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/non-normative/examples-llm-calls/
 * @see https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/
 */

import { SpanType } from '@mastra/core/observability';
import type {
  AgentRunAttributes,
  AnyExportedSpan,
  MCPToolCallAttributes,
  ModelGenerationAttributes,
  ToolCallAttributes,
  UsageStats,
  WorkflowRunAttributes,
} from '@mastra/core/observability';
import type { Attributes } from '@opentelemetry/api';
import {
  ATTR_ERROR_MESSAGE,
  ATTR_ERROR_TYPE,
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
  ATTR_GEN_AI_AGENT_ID,
  ATTR_GEN_AI_AGENT_NAME,
  ATTR_GEN_AI_TOOL_DESCRIPTION,
  ATTR_GEN_AI_OPERATION_NAME,
  ATTR_GEN_AI_RESPONSE_FINISH_REASONS,
  ATTR_GEN_AI_RESPONSE_ID,
  ATTR_GEN_AI_CONVERSATION_ID,
  ATTR_GEN_AI_SYSTEM_INSTRUCTIONS,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_GEN_AI_TOOL_NAME,
} from '@opentelemetry/semantic-conventions/incubating';
import { convertMastraMessagesToGenAIMessages } from './gen-ai-messages';

/**
 * Token usage attributes following OTel GenAI semantic conventions.
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/
 */
export interface OtelUsageMetrics {
  [ATTR_GEN_AI_USAGE_INPUT_TOKENS]?: number;
  [ATTR_GEN_AI_USAGE_OUTPUT_TOKENS]?: number;
  'gen_ai.usage.reasoning_tokens'?: number;
  'gen_ai.usage.cached_input_tokens'?: number;
  'gen_ai.usage.cache_write_tokens'?: number;
  'gen_ai.usage.audio_input_tokens'?: number;
  'gen_ai.usage.audio_output_tokens'?: number;
}

/**
 * Formats UsageStats to OTel GenAI semantic convention attributes.
 */
export function formatUsageMetrics(usage?: UsageStats): OtelUsageMetrics {
  if (!usage) return {};

  const metrics: OtelUsageMetrics = {};

  if (usage.inputTokens !== undefined) {
    metrics[ATTR_GEN_AI_USAGE_INPUT_TOKENS] = usage.inputTokens;
  }

  if (usage.outputTokens !== undefined) {
    metrics[ATTR_GEN_AI_USAGE_OUTPUT_TOKENS] = usage.outputTokens;
  }

  // Reasoning tokens from outputDetails
  if (usage.outputDetails?.reasoning !== undefined) {
    metrics['gen_ai.usage.reasoning_tokens'] = usage.outputDetails.reasoning;
  }

  // Cache read tokens from inputDetails
  if (usage.inputDetails?.cacheRead !== undefined) {
    metrics['gen_ai.usage.cached_input_tokens'] = usage.inputDetails.cacheRead;
  }

  // Cache write tokens from inputDetails
  if (usage.inputDetails?.cacheWrite !== undefined) {
    metrics['gen_ai.usage.cache_write_tokens'] = usage.inputDetails.cacheWrite;
  }

  // Audio tokens from inputDetails/outputDetails
  if (usage.inputDetails?.audio !== undefined) {
    metrics['gen_ai.usage.audio_input_tokens'] = usage.inputDetails.audio;
  }
  if (usage.outputDetails?.audio !== undefined) {
    metrics['gen_ai.usage.audio_output_tokens'] = usage.outputDetails.audio;
  }

  return metrics;
}

/**
 * Get the operation name based on span type for gen_ai.operation.name
 */
function getOperationName(span: AnyExportedSpan): string {
  switch (span.type) {
    case SpanType.MODEL_GENERATION:
      return 'chat';
    case SpanType.TOOL_CALL:
    case SpanType.MCP_TOOL_CALL:
      return 'execute_tool';
    case SpanType.AGENT_RUN:
      return 'invoke_agent';
    case SpanType.WORKFLOW_RUN:
      return 'invoke_workflow';
    default:
      return span.type.toLowerCase();
  }
}
/**
 * Keep only unicode letters, numbers, dot, underscore, space, dash.
 */
function sanitizeSpanName(name: string): string {
  return name.replace(/[^\p{L}\p{N}._ -]/gu, '');
}

function getSpanIdentifier(span: AnyExportedSpan): string | null {
  switch (span.type) {
    case SpanType.MODEL_GENERATION: {
      const attrs = span.attributes as ModelGenerationAttributes;
      return attrs?.model ?? 'unknown';
    }

    case SpanType.TOOL_CALL:
    case SpanType.MCP_TOOL_CALL: {
      const attrs = span.attributes as ToolCallAttributes | MCPToolCallAttributes;
      return attrs?.toolId ?? 'unknown';
    }

    case SpanType.AGENT_RUN: {
      const attrs = span.attributes as AgentRunAttributes;
      return attrs?.agentName ?? attrs?.agentId ?? 'unknown';
    }

    case SpanType.WORKFLOW_RUN: {
      const attrs = span.attributes as WorkflowRunAttributes;
      return attrs?.workflowId ?? 'unknown';
    }

    default:
      return null;
  }
}

/**
 * Get an OTEL-compliant span name based on span type and attributes
 */
export function getSpanName(span: AnyExportedSpan): string {
  const identifier = getSpanIdentifier(span);

  if (identifier) {
    const operation = getOperationName(span);
    return `${operation} ${identifier}`;
  }

  // For other types, use a simplified version of the original name
  return sanitizeSpanName(span.name);
}

/**
 * Gets OpenTelemetry attributes from Mastra Span
 * Following OTEL Semantic Conventions for GenAI
 */
export function getAttributes(span: AnyExportedSpan): Attributes {
  const attributes: Attributes = {};
  const spanType = span.type.toLowerCase();

  // Add gen_ai.operation.name based on span type
  attributes[ATTR_GEN_AI_OPERATION_NAME] = getOperationName(span);

  // Add span type for better visibility
  attributes['mastra.span.type'] = span.type;

  // Handle input/output based on span type
  // Always add input/output for Laminar compatibility
  if (span.input !== undefined) {
    const inputStr = typeof span.input === 'string' ? span.input : JSON.stringify(span.input);
    // Add specific attributes based on span type
    if (span.type === SpanType.MODEL_GENERATION) {
      attributes[ATTR_GEN_AI_INPUT_MESSAGES] = convertMastraMessagesToGenAIMessages(inputStr);
    } else if (span.type === SpanType.TOOL_CALL || span.type === SpanType.MCP_TOOL_CALL) {
      attributes['gen_ai.tool.call.arguments'] = inputStr;
    } else {
      attributes[`mastra.${spanType}.input`] = inputStr;
    }
  }

  if (span.output !== undefined) {
    const outputStr = typeof span.output === 'string' ? span.output : JSON.stringify(span.output);
    // Add specific attributes based on span type
    if (span.type === SpanType.MODEL_GENERATION) {
      attributes[ATTR_GEN_AI_OUTPUT_MESSAGES] = convertMastraMessagesToGenAIMessages(outputStr);
      // TODO
      // attributes['gen_ai.output.type'] = image/json/speech/text/<other>
    } else if (span.type === SpanType.TOOL_CALL || span.type === SpanType.MCP_TOOL_CALL) {
      attributes['gen_ai.tool.call.result'] = outputStr;
    } else {
      attributes[`mastra.${spanType}.output`] = outputStr;
    }
  }

  // Add model-specific attributes using OTEL semantic conventions
  if (span.type === SpanType.MODEL_GENERATION && span.attributes) {
    const modelAttrs = span.attributes as ModelGenerationAttributes;

    // Model and provider
    if (modelAttrs.model) {
      attributes[ATTR_GEN_AI_REQUEST_MODEL] = modelAttrs.model;
    }

    if (modelAttrs.provider) {
      attributes[ATTR_GEN_AI_PROVIDER_NAME] = normalizeProvider(modelAttrs.provider);
    }

    // Agent context - allows correlating model generation with the agent that invoked it
    if (modelAttrs.agentId) {
      attributes[ATTR_GEN_AI_AGENT_ID] = modelAttrs.agentId;
    }
    if (modelAttrs.agentName) {
      attributes[ATTR_GEN_AI_AGENT_NAME] = modelAttrs.agentName;
    }
    // Token usage - use OTEL standard naming + OpenInference conventions
    Object.assign(attributes, formatUsageMetrics(modelAttrs.usage));

    // Parameters using OTEL conventions
    if (modelAttrs.parameters) {
      if (modelAttrs.parameters.temperature !== undefined) {
        attributes[ATTR_GEN_AI_REQUEST_TEMPERATURE] = modelAttrs.parameters.temperature;
      }
      if (modelAttrs.parameters.maxOutputTokens !== undefined) {
        attributes[ATTR_GEN_AI_REQUEST_MAX_TOKENS] = modelAttrs.parameters.maxOutputTokens;
      }
      if (modelAttrs.parameters.topP !== undefined) {
        attributes[ATTR_GEN_AI_REQUEST_TOP_P] = modelAttrs.parameters.topP;
      }
      if (modelAttrs.parameters.topK !== undefined) {
        attributes[ATTR_GEN_AI_REQUEST_TOP_K] = modelAttrs.parameters.topK;
      }
      if (modelAttrs.parameters.presencePenalty !== undefined) {
        attributes[ATTR_GEN_AI_REQUEST_PRESENCE_PENALTY] = modelAttrs.parameters.presencePenalty;
      }
      if (modelAttrs.parameters.frequencyPenalty !== undefined) {
        attributes[ATTR_GEN_AI_REQUEST_FREQUENCY_PENALTY] = modelAttrs.parameters.frequencyPenalty;
      }
      if (modelAttrs.parameters.stopSequences) {
        attributes[ATTR_GEN_AI_REQUEST_STOP_SEQUENCES] = JSON.stringify(modelAttrs.parameters.stopSequences);
      }
      if (modelAttrs.parameters.seed) {
        attributes[ATTR_GEN_AI_REQUEST_SEED] = modelAttrs.parameters.seed;
      }
    }

    // Response attributes
    if (modelAttrs.finishReason) {
      attributes[ATTR_GEN_AI_RESPONSE_FINISH_REASONS] = JSON.stringify([modelAttrs.finishReason]);
    }
    if (modelAttrs.responseModel) {
      attributes[ATTR_GEN_AI_RESPONSE_MODEL] = modelAttrs.responseModel;
    }
    if (modelAttrs.responseId) {
      attributes[ATTR_GEN_AI_RESPONSE_ID] = modelAttrs.responseId;
    }

    // Server attributes
    if (modelAttrs.serverAddress) {
      attributes[ATTR_SERVER_ADDRESS] = modelAttrs.serverAddress;
    }
    if (modelAttrs.serverPort !== undefined) {
      attributes[ATTR_SERVER_PORT] = modelAttrs.serverPort;
    }
  }

  // Add tool-specific attributes using OTEL conventions
  if ((span.type === SpanType.TOOL_CALL || span.type === SpanType.MCP_TOOL_CALL) && span.attributes) {
    const toolAttrs = span.attributes as ToolCallAttributes | MCPToolCallAttributes;

    // Tool identification
    if (toolAttrs.toolId) {
      attributes[ATTR_GEN_AI_TOOL_NAME] = toolAttrs.toolId;
    }

    //TODO:
    // attributes['gen_ai.tool.call.id'] = call_mszuSIzqtI65i1wAUOE8w5H4
    // attributes['gen_ai.tool.type'] = function; extension; datastore

    // MCP-specific attributes
    if (span.type === SpanType.MCP_TOOL_CALL) {
      const mcpAttrs = toolAttrs as MCPToolCallAttributes;
      if (mcpAttrs.mcpServer) {
        attributes[ATTR_SERVER_ADDRESS] = mcpAttrs.mcpServer;
      }
    } else {
      if ((toolAttrs as ToolCallAttributes).toolDescription) {
        attributes[ATTR_GEN_AI_TOOL_DESCRIPTION] = (toolAttrs as ToolCallAttributes).toolDescription;
      }
    }
  }

  // Add agent-specific attributes
  if (span.type === SpanType.AGENT_RUN && span.attributes) {
    const agentAttrs = span.attributes as AgentRunAttributes;
    if (agentAttrs.agentId) {
      attributes[ATTR_GEN_AI_AGENT_ID] = agentAttrs.agentId;
    }
    if (agentAttrs.agentName) {
      attributes[ATTR_GEN_AI_AGENT_NAME] = agentAttrs.agentName;
    }
    if (agentAttrs.conversationId) {
      attributes[ATTR_GEN_AI_CONVERSATION_ID] = agentAttrs.conversationId;
    }
    if (agentAttrs.maxSteps) {
      attributes[`mastra.${spanType}.max_steps`] = agentAttrs.maxSteps;
    }
    if (agentAttrs.availableTools) {
      attributes[`gen_ai.tool.definitions`] = JSON.stringify(agentAttrs.availableTools);
    }

    //TODO:
    // attributes[ATTR_GEN_AI_AGENT_DESCRIPTION] = agentAttrs.description;
    // attributes[ATTR_GEN_AI_REQUEST_MODEL] = agentAttrs.model.name;

    attributes[ATTR_GEN_AI_SYSTEM_INSTRUCTIONS] = agentAttrs.instructions;
  }

  // Add error information if present
  if (span.errorInfo) {
    attributes[ATTR_ERROR_TYPE] = span.errorInfo.id || 'unknown';
    attributes[ATTR_ERROR_MESSAGE] = span.errorInfo.message;
    if (span.errorInfo.domain) {
      attributes['error.domain'] = span.errorInfo.domain;
    }
    if (span.errorInfo.category) {
      attributes['error.category'] = span.errorInfo.category;
    }
  }

  return attributes;
}

/**
 * Canonical OTel provider keys mapped to a list of possible fuzzy aliases.
 */
const PROVIDER_ALIASES: Record<string, string[]> = {
  anthropic: ['anthropic', 'claude'],
  'aws.bedrock': ['awsbedrock', 'bedrock', 'amazonbedrock'],
  'azure.ai.inference': ['azureaiinference', 'azureinference'],
  'azure.ai.openai': ['azureaiopenai', 'azureopenai', 'msopenai', 'microsoftopenai'],
  cohere: ['cohere'],
  deepseek: ['deepseek'],
  'gcp.gemini': ['gcpgemini', 'gemini'],
  'gcp.gen_ai': ['gcpgenai', 'googlegenai', 'googleai'],
  'gcp.vertex_ai': ['gcpvertexai', 'vertexai'],
  groq: ['groq'],
  'ibm.watsonx.ai': ['ibmwatsonxai', 'watsonx', 'watsonxai'],
  mistral_ai: ['mistral', 'mistralai'],
  openai: ['openai', 'oai'],
  perplexity: ['perplexity', 'pplx'],
  x_ai: ['xai', 'x-ai', 'x_ai', 'x.com ai'],
};

/**
 * Normalize a provider input string into a matchable token.
 * Keep only alphanumerics and lowercase the result.
 */
function normalizeProviderString(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Attempts to map a providerName to one of the canonical OTel provider names.
 * If no match is found, returns the original providerName unchanged.
 */
function normalizeProvider(providerName: string): string {
  const normalized = normalizeProviderString(providerName);

  for (const [canonical, aliases] of Object.entries(PROVIDER_ALIASES)) {
    for (const alias of aliases) {
      if (normalized === alias) {
        return canonical;
      }
    }
  }

  // No match → return the raw input in lowercase
  return providerName.toLowerCase();
}
