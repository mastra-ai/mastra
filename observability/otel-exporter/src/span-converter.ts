/**
 * Convert Mastra AI spans to OpenTelemetry spans
 */

import type {
  AnyExportedAISpan,
  LLMGenerationAttributes,
  AgentRunAttributes,
  ToolCallAttributes,
  MCPToolCallAttributes,
  WorkflowRunAttributes,
} from '@mastra/core/ai-tracing';
import { AISpanType } from '@mastra/core/ai-tracing';
import { SpanKind } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';
import type { InstrumentationScope } from '@opentelemetry/core';
import type { Resource } from '@opentelemetry/resources';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { MastraReadableSpan } from './mastra-span.js';

// Map Mastra span types to OpenTelemetry span kinds following OTEL conventions
// Only non-INTERNAL mappings are specified - all others default to SpanKind.INTERNAL
const SPAN_KIND_MAPPING: Partial<Record<AISpanType, SpanKind>> = {
  // LLM operations are CLIENT spans (calling external AI services)
  [AISpanType.LLM_GENERATION]: SpanKind.CLIENT,
  [AISpanType.LLM_CHUNK]: SpanKind.CLIENT,

  // MCP tool calls are CLIENT (external service calls)
  [AISpanType.MCP_TOOL_CALL]: SpanKind.CLIENT,

  // Root spans for agent/workflow are SERVER (entry points)
  [AISpanType.AGENT_RUN]: SpanKind.SERVER,
  [AISpanType.WORKFLOW_RUN]: SpanKind.SERVER,
};

/**
 * Interface for converter classes that convert a ReadableSpan to a ReadableSpan
 *
 * Useful for pre-processing ReadableSpans before they are exported.
 * For example, adding additional attributes or converting between different semantic conventions.
 */
export abstract class ReadableSpanConverterInterface {
  resource?: Resource;
  constructor(resource?: Resource) {
    this.init(resource);
  }
  /**
   * Initialize the converter with a resource
   * @param resource The resource to be attached to the ReadableSpan
   */
  abstract init(resource?: Resource): void;
  /**
   * Convert a ReadableSpan to a ReadableSpan
   * @param span The ReadableSpan to convert
   * @returns The converted ReadableSpan
   */
  abstract convertSpan(span: ReadableSpan): ReadableSpan;
}

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
  convertSpan(aiSpan: AnyExportedAISpan): MastraReadableSpan {
    const spanKind = this.getSpanKind(aiSpan);
    const attributes = this.buildAttributes(aiSpan);
    const spanName = this.buildSpanName(aiSpan);

    // Create a new span with OTEL-compliant naming
    const otelSpan = { ...aiSpan, name: spanName };

    return new MastraReadableSpan(
      otelSpan,
      attributes,
      spanKind,
      aiSpan.parentSpanId, // Use the parentSpanId from the Mastra span directly
      this.resource,
      this.instrumentationLibrary,
    );
  }

  /**
   * Get the appropriate SpanKind based on span type and context
   */
  private getSpanKind(aiSpan: AnyExportedAISpan): SpanKind {
    // Root spans should be SERVER
    if (aiSpan.isRootSpan) {
      if (aiSpan.type === AISpanType.AGENT_RUN || aiSpan.type === AISpanType.WORKFLOW_RUN) {
        return SpanKind.SERVER;
      }
    }
    return SPAN_KIND_MAPPING[aiSpan.type] || SpanKind.INTERNAL;
  }

  /**
   * Build OTEL-compliant span name based on span type and attributes
   */
  private buildSpanName(aiSpan: AnyExportedAISpan): string {
    switch (aiSpan.type) {
      case AISpanType.LLM_GENERATION: {
        const attrs = aiSpan.attributes as LLMGenerationAttributes;
        const operation = attrs?.resultType === 'tool_selection' ? 'tool_selection' : 'chat';
        const model = attrs?.model || 'unknown';
        return `${operation} ${model}`;
      }

      case AISpanType.TOOL_CALL:
      case AISpanType.MCP_TOOL_CALL: {
        const toolAttrs = aiSpan.attributes as ToolCallAttributes | MCPToolCallAttributes;
        const toolName = toolAttrs?.toolId || 'unknown';
        return `tool.execute ${toolName}`;
      }

      case AISpanType.AGENT_RUN: {
        const agentAttrs = aiSpan.attributes as AgentRunAttributes;
        const agentId = agentAttrs?.agentId || 'unknown';
        return `agent.${agentId}`;
      }

      case AISpanType.WORKFLOW_RUN: {
        const workflowAttrs = aiSpan.attributes as WorkflowRunAttributes;
        const workflowId = workflowAttrs?.workflowId || 'unknown';
        return `workflow.${workflowId}`;
      }

      case AISpanType.WORKFLOW_STEP:
        // Keep the original name as it's likely descriptive
        return aiSpan.name;

      default:
        // For other types, use a simplified version of the original name
        return aiSpan.name;
    }
  }

  /**
   * Build OpenTelemetry attributes from Mastra AI span
   * Following OTEL Semantic Conventions for GenAI
   */
  private buildAttributes(aiSpan: AnyExportedAISpan): Attributes {
    const attributes: Attributes = {};

    // Add gen_ai.operation.name based on span type
    attributes['gen_ai.operation.name'] = this.getOperationName(aiSpan);

    // Add span kind semantic attribute
    attributes['span.kind'] = this.getSpanKindString(aiSpan);

    // Add span type for better visibility
    attributes['mastra.span.type'] = aiSpan.type;

    // Add trace and span IDs for debugging
    attributes['mastra.trace_id'] = aiSpan.traceId;
    attributes['mastra.span_id'] = aiSpan.id;
    if (aiSpan.parentSpanId) {
      attributes['mastra.parent_span_id'] = aiSpan.parentSpanId;
    }

    // Handle input/output based on span type
    // Always add input/output for Laminar compatibility
    if (aiSpan.input !== undefined) {
      const inputStr = typeof aiSpan.input === 'string' ? aiSpan.input : JSON.stringify(aiSpan.input);
      // Add generic input for all providers
      attributes['input'] = inputStr;

      // Add specific attributes based on span type
      if (aiSpan.type === AISpanType.LLM_GENERATION) {
        attributes['gen_ai.prompt'] = inputStr;
      } else if (aiSpan.type === AISpanType.TOOL_CALL || aiSpan.type === AISpanType.MCP_TOOL_CALL) {
        attributes['gen_ai.tool.input'] = inputStr;
      }
    }

    if (aiSpan.output !== undefined) {
      const outputStr = typeof aiSpan.output === 'string' ? aiSpan.output : JSON.stringify(aiSpan.output);
      // Add generic output for all providers
      attributes['output'] = outputStr;

      // Add specific attributes based on span type
      if (aiSpan.type === AISpanType.LLM_GENERATION) {
        attributes['gen_ai.completion'] = outputStr;
      } else if (aiSpan.type === AISpanType.TOOL_CALL || aiSpan.type === AISpanType.MCP_TOOL_CALL) {
        attributes['gen_ai.tool.output'] = outputStr;
      }
    }

    // Add LLM-specific attributes using OTEL semantic conventions
    if (aiSpan.type === AISpanType.LLM_GENERATION && aiSpan.attributes) {
      const llmAttrs = aiSpan.attributes as LLMGenerationAttributes;

      // Model and provider
      if (llmAttrs.model) {
        attributes['gen_ai.request.model'] = llmAttrs.model;
      }

      if (llmAttrs.provider) {
        attributes['gen_ai.system'] = llmAttrs.provider;
      }

      // Token usage - use OTEL standard naming
      if (llmAttrs.usage) {
        // Handle both v5 format (inputTokens/outputTokens) and legacy format (promptTokens/completionTokens)
        const inputTokens = llmAttrs.usage.inputTokens ?? llmAttrs.usage.promptTokens;
        const outputTokens = llmAttrs.usage.outputTokens ?? llmAttrs.usage.completionTokens;

        if (inputTokens !== undefined) {
          attributes['gen_ai.usage.input_tokens'] = inputTokens;
        }
        if (outputTokens !== undefined) {
          attributes['gen_ai.usage.output_tokens'] = outputTokens;
        }
        if (llmAttrs.usage.totalTokens !== undefined) {
          attributes['gen_ai.usage.total_tokens'] = llmAttrs.usage.totalTokens;
        }

        // Add other token metrics if present
        if (llmAttrs.usage.reasoningTokens !== undefined) {
          attributes['gen_ai.usage.reasoning_tokens'] = llmAttrs.usage.reasoningTokens;
        }
        if (llmAttrs.usage.cachedInputTokens !== undefined) {
          attributes['gen_ai.usage.cached_input_tokens'] = llmAttrs.usage.cachedInputTokens;
        }
      }

      // Parameters using OTEL conventions
      if (llmAttrs.parameters) {
        if (llmAttrs.parameters.temperature !== undefined) {
          attributes['gen_ai.request.temperature'] = llmAttrs.parameters.temperature;
        }
        if (llmAttrs.parameters.maxOutputTokens !== undefined) {
          attributes['gen_ai.request.max_tokens'] = llmAttrs.parameters.maxOutputTokens;
        }
        if (llmAttrs.parameters.topP !== undefined) {
          attributes['gen_ai.request.top_p'] = llmAttrs.parameters.topP;
        }
        if (llmAttrs.parameters.topK !== undefined) {
          attributes['gen_ai.request.top_k'] = llmAttrs.parameters.topK;
        }
        if (llmAttrs.parameters.presencePenalty !== undefined) {
          attributes['gen_ai.request.presence_penalty'] = llmAttrs.parameters.presencePenalty;
        }
        if (llmAttrs.parameters.frequencyPenalty !== undefined) {
          attributes['gen_ai.request.frequency_penalty'] = llmAttrs.parameters.frequencyPenalty;
        }
        if (llmAttrs.parameters.stopSequences) {
          attributes['gen_ai.request.stop_sequences'] = JSON.stringify(llmAttrs.parameters.stopSequences);
        }
      }

      // Response attributes
      if (llmAttrs.finishReason) {
        attributes['gen_ai.response.finish_reasons'] = llmAttrs.finishReason;
      }
    }

    // Add tool-specific attributes using OTEL conventions
    if ((aiSpan.type === AISpanType.TOOL_CALL || aiSpan.type === AISpanType.MCP_TOOL_CALL) && aiSpan.attributes) {
      const toolAttrs = aiSpan.attributes as ToolCallAttributes | MCPToolCallAttributes;

      // Tool identification
      if (toolAttrs.toolId) {
        attributes['gen_ai.tool.name'] = toolAttrs.toolId;
      }

      // MCP-specific attributes
      if (aiSpan.type === AISpanType.MCP_TOOL_CALL) {
        const mcpAttrs = toolAttrs as MCPToolCallAttributes;
        if (mcpAttrs.mcpServer) {
          attributes['mcp.server'] = mcpAttrs.mcpServer;
        }
        if (mcpAttrs.serverVersion) {
          attributes['mcp.server.version'] = mcpAttrs.serverVersion;
        }
      } else {
        if ((toolAttrs as ToolCallAttributes).toolDescription) {
          attributes['gen_ai.tool.description'] = (toolAttrs as ToolCallAttributes).toolDescription;
        }
      }

      // Tool execution result
      if (toolAttrs.success !== undefined) {
        attributes['gen_ai.tool.success'] = toolAttrs.success;
      }
    }

    // Add agent-specific attributes
    if (aiSpan.type === AISpanType.AGENT_RUN && aiSpan.attributes) {
      const agentAttrs = aiSpan.attributes as AgentRunAttributes;
      if (agentAttrs.agentId) {
        attributes['agent.id'] = agentAttrs.agentId;
      }
      if (agentAttrs.maxSteps) {
        attributes['agent.max_steps'] = agentAttrs.maxSteps;
      }
      if (agentAttrs.availableTools) {
        attributes['agent.available_tools'] = JSON.stringify(agentAttrs.availableTools);
      }
    }

    // Add workflow-specific attributes
    if (aiSpan.type === AISpanType.WORKFLOW_RUN && aiSpan.attributes) {
      const workflowAttrs = aiSpan.attributes as WorkflowRunAttributes;
      if (workflowAttrs.workflowId) {
        attributes['workflow.id'] = workflowAttrs.workflowId;
      }
      if (workflowAttrs.status) {
        attributes['workflow.status'] = workflowAttrs.status;
      }
    }

    // Add error information if present
    if (aiSpan.errorInfo) {
      attributes['error'] = true;
      attributes['error.type'] = aiSpan.errorInfo.id || 'unknown';
      attributes['error.message'] = aiSpan.errorInfo.message;
      if (aiSpan.errorInfo.domain) {
        attributes['error.domain'] = aiSpan.errorInfo.domain;
      }
      if (aiSpan.errorInfo.category) {
        attributes['error.category'] = aiSpan.errorInfo.category;
      }
    }

    // Add metadata as custom attributes with proper typing
    if (aiSpan.metadata) {
      Object.entries(aiSpan.metadata).forEach(([key, value]) => {
        // Skip if attribute already exists
        if (!attributes[key]) {
          // Ensure value is a valid OTEL attribute type
          if (value === null || value === undefined) {
            return;
          }
          if (typeof value === 'object') {
            attributes[key] = JSON.stringify(value);
          } else {
            attributes[key] = value;
          }
        }
      });
    }

    // Add timing information
    if (aiSpan.startTime) {
      attributes['mastra.start_time'] = aiSpan.startTime.toISOString();
    }
    if (aiSpan.endTime) {
      attributes['mastra.end_time'] = aiSpan.endTime.toISOString();
      const duration = aiSpan.endTime.getTime() - aiSpan.startTime.getTime();
      attributes['mastra.duration_ms'] = duration;
    }

    return attributes;
  }

  /**
   * Get the operation name based on span type for gen_ai.operation.name
   */
  private getOperationName(aiSpan: AnyExportedAISpan): string {
    switch (aiSpan.type) {
      case AISpanType.LLM_GENERATION: {
        const attrs = aiSpan.attributes as LLMGenerationAttributes;
        return attrs?.resultType === 'tool_selection' ? 'tool_selection' : 'chat';
      }
      case AISpanType.TOOL_CALL:
      case AISpanType.MCP_TOOL_CALL:
        return 'tool.execute';
      case AISpanType.AGENT_RUN:
        return 'agent.run';
      case AISpanType.WORKFLOW_RUN:
        return 'workflow.run';
      default:
        return aiSpan.type.replace(/_/g, '.');
    }
  }

  /**
   * Get span kind as string for attribute
   */
  private getSpanKindString(aiSpan: AnyExportedAISpan): string {
    const kind = this.getSpanKind(aiSpan);
    switch (kind) {
      case SpanKind.SERVER:
        return 'server';
      case SpanKind.CLIENT:
        return 'client';
      case SpanKind.INTERNAL:
        return 'internal';
      case SpanKind.PRODUCER:
        return 'producer';
      case SpanKind.CONSUMER:
        return 'consumer';
      default:
        return 'internal';
    }
  }
}
