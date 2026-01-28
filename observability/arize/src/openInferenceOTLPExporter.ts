import { convertGenAISpanAttributesToOpenInferenceSpanAttributes } from '@arizeai/openinference-genai';
import type { Mutable } from '@arizeai/openinference-genai/types';
import {
  INPUT_MIME_TYPE,
  INPUT_VALUE,
  LLM_TOKEN_COUNT_COMPLETION,
  LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO,
  LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING,
  LLM_TOKEN_COUNT_PROMPT,
  LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO,
  LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ,
  LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE,
  LLM_TOKEN_COUNT_TOTAL,
  METADATA,
  OpenInferenceSpanKind,
  OUTPUT_MIME_TYPE,
  OUTPUT_VALUE,
  SemanticConventions,
  SESSION_ID,
  TAG_TAGS,
  USER_ID,
} from '@arizeai/openinference-semantic-conventions';
import type { ExportResult } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import {
  ATTR_GEN_AI_INPUT_MESSAGES,
  ATTR_GEN_AI_OUTPUT_MESSAGES,
  ATTR_GEN_AI_USAGE_INPUT_TOKENS,
  ATTR_GEN_AI_USAGE_OUTPUT_TOKENS,
  ATTR_GEN_AI_TOOL_CALL_ARGUMENTS,
  ATTR_GEN_AI_TOOL_CALL_RESULT,
} from '@opentelemetry/semantic-conventions/incubating';

// GenAI usage attribute keys (not all are in @opentelemetry/semantic-conventions yet)
const GEN_AI_USAGE_REASONING_TOKENS = 'gen_ai.usage.reasoning_tokens';
const GEN_AI_USAGE_CACHED_INPUT_TOKENS = 'gen_ai.usage.cached_input_tokens';
const GEN_AI_USAGE_CACHE_WRITE_TOKENS = 'gen_ai.usage.cache_write_tokens';
const GEN_AI_USAGE_AUDIO_INPUT_TOKENS = 'gen_ai.usage.audio_input_tokens';
const GEN_AI_USAGE_AUDIO_OUTPUT_TOKENS = 'gen_ai.usage.audio_output_tokens';

const MASTRA_GENERAL_PREFIX = 'mastra.';
const MASTRA_METADATA_PREFIX = 'mastra.metadata.';
const MASTRA_MODEL_STEP_INPUT = 'mastra.model_step.input';
const MASTRA_MODEL_STEP_OUTPUT = 'mastra.model_step.output';
const MASTRA_MODEL_CHUNK_OUTPUT = 'mastra.model_chunk.output';
const MASTRA_SPAN_TYPE = 'mastra.span.type';

/**
 * Maps Mastra span types to OpenInference span kinds.
 *
 * The @arizeai/openinference-genai library defaults all spans to LLM kind,
 * which is incorrect for workflow, agent, tool, and other non-LLM spans.
 * This mapping overrides the span kind based on the mastra.span.type attribute.
 */
const SPAN_TYPE_TO_KIND: Record<string, OpenInferenceSpanKind> = {
  // Workflow spans -> CHAIN
  workflow_run: OpenInferenceSpanKind.CHAIN,
  workflow_step: OpenInferenceSpanKind.CHAIN,
  workflow_conditional: OpenInferenceSpanKind.CHAIN,
  workflow_conditional_eval: OpenInferenceSpanKind.CHAIN,
  workflow_parallel: OpenInferenceSpanKind.CHAIN,
  workflow_loop: OpenInferenceSpanKind.CHAIN,
  workflow_sleep: OpenInferenceSpanKind.CHAIN,
  workflow_wait_event: OpenInferenceSpanKind.CHAIN,
  // Model spans -> LLM
  model_generation: OpenInferenceSpanKind.LLM,
  model_step: OpenInferenceSpanKind.LLM,
  model_chunk: OpenInferenceSpanKind.LLM,
  // Tool spans -> TOOL
  tool_call: OpenInferenceSpanKind.TOOL,
  mcp_tool_call: OpenInferenceSpanKind.TOOL,
  // Agent spans -> AGENT
  agent_run: OpenInferenceSpanKind.AGENT,
  // Other spans -> CHAIN
  processor_run: OpenInferenceSpanKind.CHAIN,
  generic: OpenInferenceSpanKind.CHAIN,
};

/**
 * Converts GenAI usage metrics to OpenInference LLM token count attributes.
 * Maps from OTEL GenAI semantic conventions to OpenInference semantic conventions.
 *
 * @param attributes - The span attributes containing GenAI usage metrics
 * @returns OpenInference token count attributes
 */
function convertUsageMetricsToOpenInference(attributes: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  const inputTokens = attributes[ATTR_GEN_AI_USAGE_INPUT_TOKENS];
  const outputTokens = attributes[ATTR_GEN_AI_USAGE_OUTPUT_TOKENS];

  // Core token counts
  if (inputTokens !== undefined) {
    result[LLM_TOKEN_COUNT_PROMPT] = inputTokens;
  }
  if (outputTokens !== undefined) {
    result[LLM_TOKEN_COUNT_COMPLETION] = outputTokens;
  }

  // Total tokens (compute if we have both input and output)
  if (inputTokens !== undefined && outputTokens !== undefined) {
    result[LLM_TOKEN_COUNT_TOTAL] = inputTokens + outputTokens;
  }

  // Cache tokens (prompt details)
  const cachedInputTokens = attributes[GEN_AI_USAGE_CACHED_INPUT_TOKENS];
  if (cachedInputTokens !== undefined) {
    result[LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ] = cachedInputTokens;
  }

  const cacheWriteTokens = attributes[GEN_AI_USAGE_CACHE_WRITE_TOKENS];
  if (cacheWriteTokens !== undefined) {
    result[LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE] = cacheWriteTokens;
  }

  // Reasoning tokens (completion details)
  const reasoningTokens = attributes[GEN_AI_USAGE_REASONING_TOKENS];
  if (reasoningTokens !== undefined) {
    result[LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING] = reasoningTokens;
  }

  // Audio tokens
  const audioInputTokens = attributes[GEN_AI_USAGE_AUDIO_INPUT_TOKENS];
  if (audioInputTokens !== undefined) {
    result[LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO] = audioInputTokens;
  }

  const audioOutputTokens = attributes[GEN_AI_USAGE_AUDIO_OUTPUT_TOKENS];
  if (audioOutputTokens !== undefined) {
    result[LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO] = audioOutputTokens;
  }

  return result;
}

/**
 * Splits Mastra span attributes into two groups:
 * - `metadata`: keys starting with "mastra.metadata." (prefix removed)
 * - `other`: all remaining keys starting with "mastra."
 *
 * Any attributes not starting with "mastra." are ignored entirely.
 */
function splitMastraAttributes(attributes: Record<string, any>): {
  mastraMetadata: Record<string, any>;
  mastraOther: Record<string, any>;
} {
  return Object.entries(attributes).reduce(
    (acc, [key, value]) => {
      if (key.startsWith(MASTRA_GENERAL_PREFIX)) {
        if (key.startsWith(MASTRA_METADATA_PREFIX)) {
          const strippedKey = key.slice(MASTRA_METADATA_PREFIX.length);
          acc.mastraMetadata[strippedKey] = value;
        } else {
          acc.mastraOther[key] = value;
        }
      }
      return acc;
    },
    {
      mastraMetadata: {} as Record<string, any>,
      mastraOther: {} as Record<string, any>,
    },
  );
}

export class OpenInferenceOTLPTraceExporter extends OTLPTraceExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void) {
    const processedSpans = spans.map(span => {
      const attributes = { ...(span.attributes ?? {}) };
      const mutableSpan = span as Mutable<ReadableSpan>;

      const { mastraMetadata, mastraOther } = splitMastraAttributes(attributes);
      const processedAttributes = convertGenAISpanAttributesToOpenInferenceSpanAttributes(attributes);

      // only add processed attributes if conversion was successful
      if (processedAttributes) {
        const threadId = mastraMetadata['threadId'];
        if (threadId) {
          delete mastraMetadata['threadId'];
          processedAttributes[SESSION_ID] = threadId;
        }

        // Map mastra.tags to OpenInference native tag.tags convention (tags are only on root spans)
        if (mastraOther['mastra.tags']) {
          processedAttributes[TAG_TAGS] = mastraOther['mastra.tags'];
          delete mastraOther['mastra.tags'];
        }

        const userId = mastraMetadata['userId'];
        if (userId) {
          delete mastraMetadata['userId'];
          processedAttributes[USER_ID] = userId;
        }

        // Gather custom metadata into OpenInference metadata (flat best-effort)
        if (Object.keys(mastraMetadata).length > 0) {
          try {
            processedAttributes[METADATA] = JSON.stringify(mastraMetadata);
          } catch {
            // best-effort only
          }
        }

        const inputMessages =
          attributes[ATTR_GEN_AI_INPUT_MESSAGES] ??
          attributes[ATTR_GEN_AI_TOOL_CALL_ARGUMENTS] ??
          mastraOther[MASTRA_MODEL_STEP_INPUT];
        if (inputMessages) {
          processedAttributes[INPUT_MIME_TYPE] = 'application/json';
          processedAttributes[INPUT_VALUE] = inputMessages;
        }
        const outputMessages =
          attributes[ATTR_GEN_AI_OUTPUT_MESSAGES] ??
          attributes[ATTR_GEN_AI_TOOL_CALL_RESULT] ??
          mastraOther[MASTRA_MODEL_STEP_OUTPUT] ??
          mastraOther[MASTRA_MODEL_CHUNK_OUTPUT];
        if (outputMessages) {
          processedAttributes[OUTPUT_MIME_TYPE] = 'application/json';
          processedAttributes[OUTPUT_VALUE] = outputMessages;
        }

        // Map generic Mastra span input/output to OpenInference input/output
        // These are set by Mastra's gen-ai-semantics.ts for non-LLM/tool spans
        // (e.g., mastra.processor_run.input, mastra.workflow_run.input, etc.)
        if (!processedAttributes[INPUT_VALUE]) {
          for (const key of Object.keys(mastraOther)) {
            if (key.endsWith('.input')) {
              processedAttributes[INPUT_MIME_TYPE] = 'application/json';
              processedAttributes[INPUT_VALUE] = mastraOther[key];
              break;
            }
          }
        }
        if (!processedAttributes[OUTPUT_VALUE]) {
          for (const key of Object.keys(mastraOther)) {
            if (key.endsWith('.output')) {
              processedAttributes[OUTPUT_MIME_TYPE] = 'application/json';
              processedAttributes[OUTPUT_VALUE] = mastraOther[key];
              break;
            }
          }
        }

        // Convert GenAI usage metrics to OpenInference token count attributes
        const usageMetrics = convertUsageMetricsToOpenInference(attributes);
        Object.assign(processedAttributes, usageMetrics);

        mutableSpan.attributes = { ...processedAttributes, ...mastraOther };

        // Override span kind based on mastra.span.type
        // The @arizeai/openinference-genai library incorrectly defaults all spans to LLM kind.
        // We need to map based on the actual Mastra span type.
        const spanType = mastraOther[MASTRA_SPAN_TYPE];
        if (typeof spanType === 'string' && SPAN_TYPE_TO_KIND[spanType]) {
          mutableSpan.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND] = SPAN_TYPE_TO_KIND[spanType];
        }
      }

      return mutableSpan;
    });

    super.export(processedSpans, resultCallback);
  }
}
