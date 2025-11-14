/**
 * Convert Mastra Spans to OpenTelemetry spans
 */

import type {
  AnyExportedSpan,
  ModelGenerationAttributes,
  AgentRunAttributes,
  ToolCallAttributes,
  MCPToolCallAttributes,
  WorkflowRunAttributes,
} from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { SpanKind } from '@opentelemetry/api';
import type { Attributes } from '@opentelemetry/api';
import type { InstrumentationScope } from '@opentelemetry/core';
import type { Resource } from '@opentelemetry/resources';
import { MastraReadableSpan } from './mastra-span.js';

// Map Mastra span types to OpenTelemetry span kinds following OTEL conventions
// Only non-INTERNAL mappings are specified - all others default to SpanKind.INTERNAL
const SPAN_KIND_MAPPING: Partial<Record<SpanType, SpanKind>> = {
  // Model operations are CLIENT spans (calling external AI services)
  [SpanType.MODEL_GENERATION]: SpanKind.CLIENT,
  [SpanType.MODEL_CHUNK]: SpanKind.CLIENT,

  // MCP tool calls are CLIENT (external service calls)
  [SpanType.MCP_TOOL_CALL]: SpanKind.CLIENT,

  // Root spans for agent/workflow are SERVER (entry points)
  [SpanType.AGENT_RUN]: SpanKind.SERVER,
  [SpanType.WORKFLOW_RUN]: SpanKind.SERVER,
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
   * Convert a Mastra Span to an OpenTelemetry ReadableSpan
   * This preserves Mastra's trace and span IDs
   */
  convertSpan(Span: AnyExportedSpan): MastraReadableSpan {
    const spanKind = this.getSpanKind(Span);
    const attributes = this.buildAttributes(Span);
    const spanName = this.buildSpanName(Span);

    // Create a new span with OTEL-compliant naming
    const otelSpan = { ...Span, name: spanName };

    return new MastraReadableSpan(
      otelSpan,
      attributes,
      spanKind,
      Span.parentSpanId, // Use the parentSpanId from the Mastra span directly
      this.resource,
      this.instrumentationLibrary,
    );
  }

  /**
   * Get the appropriate SpanKind based on span type and context
   */
  private getSpanKind(Span: AnyExportedSpan): SpanKind {
    // Root spans should be SERVER
    if (Span.isRootSpan) {
      if (Span.type === SpanType.AGENT_RUN || Span.type === SpanType.WORKFLOW_RUN) {
        return SpanKind.SERVER;
      }
    }
    return SPAN_KIND_MAPPING[Span.type] || SpanKind.INTERNAL;
  }

  /**
   * Build OTEL-compliant span name based on span type and attributes
   */
  private buildSpanName(Span: AnyExportedSpan): string {
    switch (Span.type) {
      case SpanType.MODEL_GENERATION: {
        const attrs = Span.attributes as ModelGenerationAttributes;
        const operation = attrs?.resultType === 'tool_selection' ? 'tool_selection' : 'chat';
        const model = attrs?.model || 'unknown';
        return `${operation} ${model}`;
      }

      case SpanType.TOOL_CALL:
      case SpanType.MCP_TOOL_CALL: {
        const toolAttrs = Span.attributes as ToolCallAttributes | MCPToolCallAttributes;
        const toolName = toolAttrs?.toolId || 'unknown';
        return `tool.execute ${toolName}`;
      }

      case SpanType.AGENT_RUN: {
        const agentAttrs = Span.attributes as AgentRunAttributes;
        const agentId = agentAttrs?.agentId || 'unknown';
        return `agent.${agentId}`;
      }

      case SpanType.WORKFLOW_RUN: {
        const workflowAttrs = Span.attributes as WorkflowRunAttributes;
        const workflowId = workflowAttrs?.workflowId || 'unknown';
        return `workflow.${workflowId}`;
      }

      case SpanType.WORKFLOW_STEP:
        // Keep the original name as it's likely descriptive
        return Span.name;

      default:
        // For other types, use a simplified version of the original name
        return Span.name;
    }
  }

  /**
   * Build OpenTelemetry attributes from Mastra Span
   * Following OTEL Semantic Conventions for GenAI
   */
  private buildAttributes(Span: AnyExportedSpan): Attributes {
    const attributes: Attributes = {};

    // Add gen_ai.operation.name based on span type
    attributes['gen_ai.operation.name'] = this.getOperationName(Span);

    // Add span kind semantic attribute
    attributes['span.kind'] = this.getSpanKindString(Span);

    // Add span type for better visibility
    attributes['mastra.span.type'] = Span.type;

    // Add trace and span IDs for debugging
    attributes['mastra.trace_id'] = Span.traceId;
    attributes['mastra.span_id'] = Span.id;
    if (Span.parentSpanId) {
      attributes['mastra.parent_span_id'] = Span.parentSpanId;
    }

    // Handle input/output based on span type
    // Always add input/output for Laminar compatibility
    if (Span.input !== undefined) {
      const inputStr = typeof Span.input === 'string' ? Span.input : JSON.stringify(Span.input);
      // Add generic input for all providers
      attributes['input'] = inputStr;

      // Add specific attributes based on span type
      if (Span.type === SpanType.MODEL_GENERATION) {
        attributes['gen_ai.prompt'] = inputStr;
      } else if (Span.type === SpanType.TOOL_CALL || Span.type === SpanType.MCP_TOOL_CALL) {
        attributes['gen_ai.tool.input'] = inputStr;
      }
    }

    if (Span.output !== undefined) {
      const outputStr = typeof Span.output === 'string' ? Span.output : JSON.stringify(Span.output);
      // Add generic output for all providers
      attributes['output'] = outputStr;

      // Add specific attributes based on span type
      if (Span.type === SpanType.MODEL_GENERATION) {
        attributes['gen_ai.completion'] = outputStr;
      } else if (Span.type === SpanType.TOOL_CALL || Span.type === SpanType.MCP_TOOL_CALL) {
        attributes['gen_ai.tool.output'] = outputStr;
      }
    }

    // Add model-specific attributes using OTEL semantic conventions
    if (Span.type === SpanType.MODEL_GENERATION && Span.attributes) {
      const modelAttrs = Span.attributes as ModelGenerationAttributes;

      // Model and provider
      if (modelAttrs.model) {
        attributes['gen_ai.request.model'] = modelAttrs.model;
      }

      if (modelAttrs.provider) {
        attributes['gen_ai.system'] = modelAttrs.provider;
      }

      // Token usage - use OTEL standard naming
      if (modelAttrs.usage) {
        // Handle both v5 format (inputTokens/outputTokens) and legacy format (promptTokens/completionTokens)
        const inputTokens = modelAttrs.usage.inputTokens ?? modelAttrs.usage.promptTokens;
        const outputTokens = modelAttrs.usage.outputTokens ?? modelAttrs.usage.completionTokens;

        if (inputTokens !== undefined) {
          attributes['gen_ai.usage.input_tokens'] = inputTokens;
        }
        if (outputTokens !== undefined) {
          attributes['gen_ai.usage.output_tokens'] = outputTokens;
        }
        if (modelAttrs.usage.totalTokens !== undefined) {
          attributes['gen_ai.usage.total_tokens'] = modelAttrs.usage.totalTokens;
        }

        // Add other token metrics if present
        if (modelAttrs.usage.reasoningTokens !== undefined) {
          attributes['gen_ai.usage.reasoning_tokens'] = modelAttrs.usage.reasoningTokens;
        }
        if (modelAttrs.usage.cachedInputTokens !== undefined) {
          attributes['gen_ai.usage.cached_input_tokens'] = modelAttrs.usage.cachedInputTokens;
        }
      }

      // Parameters using OTEL conventions
      if (modelAttrs.parameters) {
        if (modelAttrs.parameters.temperature !== undefined) {
          attributes['gen_ai.request.temperature'] = modelAttrs.parameters.temperature;
        }
        if (modelAttrs.parameters.maxOutputTokens !== undefined) {
          attributes['gen_ai.request.max_tokens'] = modelAttrs.parameters.maxOutputTokens;
        }
        if (modelAttrs.parameters.topP !== undefined) {
          attributes['gen_ai.request.top_p'] = modelAttrs.parameters.topP;
        }
        if (modelAttrs.parameters.topK !== undefined) {
          attributes['gen_ai.request.top_k'] = modelAttrs.parameters.topK;
        }
        if (modelAttrs.parameters.presencePenalty !== undefined) {
          attributes['gen_ai.request.presence_penalty'] = modelAttrs.parameters.presencePenalty;
        }
        if (modelAttrs.parameters.frequencyPenalty !== undefined) {
          attributes['gen_ai.request.frequency_penalty'] = modelAttrs.parameters.frequencyPenalty;
        }
        if (modelAttrs.parameters.stopSequences) {
          attributes['gen_ai.request.stop_sequences'] = JSON.stringify(modelAttrs.parameters.stopSequences);
        }
      }

      // Response attributes
      if (modelAttrs.finishReason) {
        attributes['gen_ai.response.finish_reasons'] = modelAttrs.finishReason;
      }
    }

    // Add tool-specific attributes using OTEL conventions
    if ((Span.type === SpanType.TOOL_CALL || Span.type === SpanType.MCP_TOOL_CALL) && Span.attributes) {
      const toolAttrs = Span.attributes as ToolCallAttributes | MCPToolCallAttributes;

      // Tool identification
      if (toolAttrs.toolId) {
        attributes['gen_ai.tool.name'] = toolAttrs.toolId;
      }

      // MCP-specific attributes
      if (Span.type === SpanType.MCP_TOOL_CALL) {
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
    if (Span.type === SpanType.AGENT_RUN && Span.attributes) {
      const agentAttrs = Span.attributes as AgentRunAttributes;
      if (agentAttrs.agentId) {
        attributes['agent.id'] = agentAttrs.agentId;
        attributes['gen_ai.agent.id'] = agentAttrs.agentId;
      }
      if (agentAttrs.maxSteps) {
        attributes['agent.max_steps'] = agentAttrs.maxSteps;
      }
      if (agentAttrs.availableTools) {
        attributes['agent.available_tools'] = JSON.stringify(agentAttrs.availableTools);
      }
    }

    // Add workflow-specific attributes
    if (Span.type === SpanType.WORKFLOW_RUN && Span.attributes) {
      const workflowAttrs = Span.attributes as WorkflowRunAttributes;
      if (workflowAttrs.workflowId) {
        attributes['workflow.id'] = workflowAttrs.workflowId;
      }
      if (workflowAttrs.status) {
        attributes['workflow.status'] = workflowAttrs.status;
      }
    }

    // Add error information if present
    if (Span.errorInfo) {
      attributes['error'] = true;
      attributes['error.type'] = Span.errorInfo.id || 'unknown';
      attributes['error.message'] = Span.errorInfo.message;
      if (Span.errorInfo.domain) {
        attributes['error.domain'] = Span.errorInfo.domain;
      }
      if (Span.errorInfo.category) {
        attributes['error.category'] = Span.errorInfo.category;
      }
    }

    // Add metadata as custom attributes with proper typing
    if (Span.metadata) {
      Object.entries(Span.metadata).forEach(([key, value]) => {
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
    if (Span.startTime) {
      attributes['mastra.start_time'] = Span.startTime.toISOString();
    }
    if (Span.endTime) {
      attributes['mastra.end_time'] = Span.endTime.toISOString();
      const duration = Span.endTime.getTime() - Span.startTime.getTime();
      attributes['mastra.duration_ms'] = duration;
    }

    return attributes;
  }

  /**
   * Get the operation name based on span type for gen_ai.operation.name
   */
  private getOperationName(Span: AnyExportedSpan): string {
    switch (Span.type) {
      case SpanType.MODEL_GENERATION: {
        const attrs = Span.attributes as ModelGenerationAttributes;
        return attrs?.resultType === 'tool_selection' ? 'tool_selection' : 'chat';
      }
      case SpanType.TOOL_CALL:
      case SpanType.MCP_TOOL_CALL:
        return 'tool.execute';
      case SpanType.AGENT_RUN:
        return 'agent.run';
      case SpanType.WORKFLOW_RUN:
        return 'workflow.run';
      default:
        return Span.type.replace(/_/g, '.');
    }
  }

  /**
   * Get span kind as string for attribute
   */
  private getSpanKindString(Span: AnyExportedSpan): string {
    const kind = this.getSpanKind(Span);
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
