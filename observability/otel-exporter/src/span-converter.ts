/**
 * Convert Mastra AI spans to OpenTelemetry spans
 */

import type { AnyExportedAISpan, LLMGenerationAttributes } from '@mastra/core/ai-tracing';
import { AISpanType } from '@mastra/core/ai-tracing';
import { SpanKind } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';
import type { InstrumentationScope } from '@opentelemetry/core';
import type { Resource } from '@opentelemetry/resources';
import { MastraReadableSpan } from './mastra-span.js';

// Map Mastra span types to OpenTelemetry span kinds
const SPAN_KIND_MAPPING: Record<AISpanType, SpanKind> = {
  [AISpanType.LLM_GENERATION]: SpanKind.CLIENT,
  [AISpanType.LLM_CHUNK]: SpanKind.CLIENT,
  [AISpanType.TOOL_CALL]: SpanKind.CLIENT,
  [AISpanType.MCP_TOOL_CALL]: SpanKind.CLIENT,
  [AISpanType.AGENT_RUN]: SpanKind.INTERNAL,
  [AISpanType.WORKFLOW_RUN]: SpanKind.INTERNAL,
  [AISpanType.WORKFLOW_STEP]: SpanKind.INTERNAL,
  [AISpanType.WORKFLOW_LOOP]: SpanKind.INTERNAL,
  [AISpanType.WORKFLOW_PARALLEL]: SpanKind.INTERNAL,
  [AISpanType.WORKFLOW_CONDITIONAL]: SpanKind.INTERNAL,
  [AISpanType.WORKFLOW_CONDITIONAL_EVAL]: SpanKind.INTERNAL,
  [AISpanType.WORKFLOW_SLEEP]: SpanKind.INTERNAL,
  [AISpanType.WORKFLOW_WAIT_EVENT]: SpanKind.INTERNAL,
  [AISpanType.GENERIC]: SpanKind.INTERNAL,
};

export class SpanConverter {
  private resource?: Resource;
  private instrumentationLibrary: InstrumentationScope;

  constructor(resource?: Resource) {
    this.resource = resource;
    this.instrumentationLibrary = {
      name: '@mastra/otel',
      version: '1.0.0',
    };
  }

  /**
   * Convert a Mastra AI span to an OpenTelemetry ReadableSpan
   * This preserves Mastra's trace and span IDs
   */
  convertSpan(aiSpan: AnyExportedAISpan, parentSpanId?: string): MastraReadableSpan {
    const spanKind = SPAN_KIND_MAPPING[aiSpan.type] || SpanKind.INTERNAL;
    const attributes = this.buildAttributes(aiSpan);

    return new MastraReadableSpan(
      aiSpan,
      attributes,
      spanKind,
      parentSpanId,
      this.resource,
      this.instrumentationLibrary,
    );
  }

  /**
   * Build OpenTelemetry attributes from Mastra AI span
   */
  private buildAttributes(aiSpan: AnyExportedAISpan): Attributes {
    const attributes: Attributes = {
      'mastra.span.type': aiSpan.type,
      // We don't need to duplicate the IDs as attributes since they're the actual span/trace IDs now
    };

    // Add input/output as attributes (serialize if needed)
    if (aiSpan.input !== undefined) {
      attributes['mastra.input'] = typeof aiSpan.input === 'string' ? aiSpan.input : JSON.stringify(aiSpan.input);
    }

    if (aiSpan.output !== undefined) {
      attributes['mastra.output'] = typeof aiSpan.output === 'string' ? aiSpan.output : JSON.stringify(aiSpan.output);
    }

    // Add LLM-specific attributes using semantic conventions
    if (aiSpan.type === AISpanType.LLM_GENERATION && aiSpan.attributes) {
      const llmAttrs = aiSpan.attributes as LLMGenerationAttributes;

      if (llmAttrs.model) {
        attributes['llm.model'] = llmAttrs.model;
        attributes['gen_ai.request.model'] = llmAttrs.model;
      }

      if (llmAttrs.provider) {
        attributes['llm.provider'] = llmAttrs.provider;
        attributes['gen_ai.system'] = llmAttrs.provider;
      }

      if (llmAttrs.usage) {
        if (llmAttrs.usage.promptTokens !== undefined) {
          attributes['llm.usage.prompt_tokens'] = llmAttrs.usage.promptTokens;
          attributes['gen_ai.usage.prompt_tokens'] = llmAttrs.usage.promptTokens;
        }
        if (llmAttrs.usage.completionTokens !== undefined) {
          attributes['llm.usage.completion_tokens'] = llmAttrs.usage.completionTokens;
          attributes['gen_ai.usage.completion_tokens'] = llmAttrs.usage.completionTokens;
        }
        if (llmAttrs.usage.totalTokens !== undefined) {
          attributes['llm.usage.total_tokens'] = llmAttrs.usage.totalTokens;
        }
      }

      if (llmAttrs.parameters) {
        Object.entries(llmAttrs.parameters).forEach(([key, value]) => {
          attributes[`llm.parameters.${key}`] = value;
        });
      }
    }

    // Add tool-specific attributes
    if ((aiSpan.type === AISpanType.TOOL_CALL || aiSpan.type === AISpanType.MCP_TOOL_CALL) && aiSpan.attributes) {
      const toolAttrs = aiSpan.attributes as any;

      if (toolAttrs.name) {
        attributes['tool.name'] = toolAttrs.name;
      }

      if (toolAttrs.description) {
        attributes['tool.description'] = toolAttrs.description;
      }
    }

    // Add custom attributes
    if (aiSpan.attributes) {
      Object.entries(aiSpan.attributes).forEach(([key, value]) => {
        if (!attributes[key]) {
          attributes[`mastra.attributes.${key}`] = value;
        }
      });
    }

    // Add metadata
    if (aiSpan.metadata) {
      Object.entries(aiSpan.metadata).forEach(([key, value]) => {
        attributes[`mastra.metadata.${key}`] = value;
      });
    }

    return attributes;
  }
}
