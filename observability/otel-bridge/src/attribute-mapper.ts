/**
 * Map Mastra AI span attributes to OpenTelemetry attributes
 */

import type {
  AnyExportedAISpan,
  LLMGenerationAttributes,
  AgentRunAttributes,
  ToolCallAttributes,
  MCPToolCallAttributes,
  WorkflowRunAttributes,
  WorkflowStepAttributes,
} from '@mastra/core/ai-tracing';
import { AISpanType } from '@mastra/core/ai-tracing';
import type { Attributes } from '@opentelemetry/api';

/**
 * Maps Mastra span attributes to OpenTelemetry semantic conventions
 */
export class AttributeMapper {
  private attributePrefix: string;

  constructor(attributePrefix = 'mastra.') {
    this.attributePrefix = attributePrefix;
  }

  /**
   * Build OTEL attributes from a Mastra span
   */
  buildAttributes(aiSpan: AnyExportedAISpan): Attributes {
    const attributes: Attributes = {};

    // Add operation name
    attributes['gen_ai.operation.name'] = this.getOperationName(aiSpan);

    // Add Mastra-specific identifiers
    attributes[`${this.attributePrefix}span.type`] = aiSpan.type;
    attributes[`${this.attributePrefix}trace_id`] = aiSpan.traceId;
    attributes[`${this.attributePrefix}span_id`] = aiSpan.id;

    if (aiSpan.parentSpanId) {
      attributes[`${this.attributePrefix}parent_span_id`] = aiSpan.parentSpanId;
    }

    // Add root span indicator
    if (aiSpan.isRootSpan) {
      attributes[`${this.attributePrefix}is_root_span`] = true;
    }

    // Add input/output
    if (aiSpan.input !== undefined) {
      const inputStr = typeof aiSpan.input === 'string' ? aiSpan.input : JSON.stringify(aiSpan.input);
      attributes['input'] = inputStr;

      if (aiSpan.type === AISpanType.LLM_GENERATION) {
        attributes['gen_ai.prompt'] = inputStr;
      } else if (aiSpan.type === AISpanType.TOOL_CALL || aiSpan.type === AISpanType.MCP_TOOL_CALL) {
        attributes['gen_ai.tool.input'] = inputStr;
      }
    }

    if (aiSpan.output !== undefined) {
      const outputStr = typeof aiSpan.output === 'string' ? aiSpan.output : JSON.stringify(aiSpan.output);
      attributes['output'] = outputStr;

      if (aiSpan.type === AISpanType.LLM_GENERATION) {
        attributes['gen_ai.completion'] = outputStr;
      } else if (aiSpan.type === AISpanType.TOOL_CALL || aiSpan.type === AISpanType.MCP_TOOL_CALL) {
        attributes['gen_ai.tool.output'] = outputStr;
      }
    }

    // Add type-specific attributes
    this.addTypeSpecificAttributes(aiSpan, attributes);

    // Add metadata
    if (aiSpan.metadata) {
      Object.entries(aiSpan.metadata).forEach(([key, value]) => {
        const attrValue = typeof value === 'object' ? JSON.stringify(value) : value;
        attributes[`${this.attributePrefix}metadata.${key}`] = attrValue as string | number | boolean;
      });
    }

    // Calculate and add latency if span is ended
    if (aiSpan.endTime && aiSpan.startTime) {
      const latencyMs = aiSpan.endTime.getTime() - aiSpan.startTime.getTime();
      attributes[`${this.attributePrefix}latency_ms`] = latencyMs;
    }

    return attributes;
  }

  /**
   * Get operation name for gen_ai.operation.name attribute
   */
  private getOperationName(aiSpan: AnyExportedAISpan): string {
    switch (aiSpan.type) {
      case AISpanType.LLM_GENERATION: {
        const attrs = aiSpan.attributes as LLMGenerationAttributes | undefined;
        return attrs?.resultType === 'tool_selection' ? 'tool_selection' : 'chat';
      }
      case AISpanType.LLM_CHUNK:
        return 'stream';
      case AISpanType.TOOL_CALL:
      case AISpanType.MCP_TOOL_CALL:
        return 'tool_call';
      case AISpanType.AGENT_RUN:
        return 'agent';
      case AISpanType.WORKFLOW_RUN:
        return 'workflow';
      case AISpanType.WORKFLOW_STEP:
        return 'workflow_step';
      case AISpanType.WORKFLOW_CONDITIONAL:
        return 'conditional';
      case AISpanType.WORKFLOW_LOOP:
        return 'loop';
      default:
        return 'generic';
    }
  }

  /**
   * Add type-specific attributes based on span type
   */
  private addTypeSpecificAttributes(aiSpan: AnyExportedAISpan, attributes: Attributes): void {
    switch (aiSpan.type) {
      case AISpanType.LLM_GENERATION:
        this.addLLMAttributes(aiSpan.attributes as LLMGenerationAttributes | undefined, attributes);
        break;
      case AISpanType.TOOL_CALL:
      case AISpanType.MCP_TOOL_CALL:
        this.addToolAttributes(
          aiSpan.attributes as ToolCallAttributes | MCPToolCallAttributes | undefined,
          attributes,
        );
        break;
      case AISpanType.AGENT_RUN:
        this.addAgentAttributes(aiSpan.attributes as AgentRunAttributes | undefined, attributes);
        break;
      case AISpanType.WORKFLOW_RUN:
        this.addWorkflowAttributes(aiSpan.attributes as WorkflowRunAttributes | undefined, attributes);
        break;
      case AISpanType.WORKFLOW_STEP:
        this.addWorkflowStepAttributes(aiSpan.attributes as WorkflowStepAttributes | undefined, attributes);
        break;
    }
  }

  /**
   * Add LLM-specific attributes using OTEL semantic conventions
   */
  private addLLMAttributes(llmAttrs: LLMGenerationAttributes | undefined, attributes: Attributes): void {
    if (!llmAttrs) return;

    // Model and provider
    if (llmAttrs.model) {
      attributes['gen_ai.request.model'] = llmAttrs.model;
    }
    if (llmAttrs.provider) {
      attributes['gen_ai.system'] = llmAttrs.provider;
    }

    // Token usage - use OTEL standard naming
    if (llmAttrs.usage) {
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
    if (llmAttrs.resultType) {
      attributes[`${this.attributePrefix}llm.result_type`] = llmAttrs.resultType;
    }
  }

  /**
   * Add tool-specific attributes
   */
  private addToolAttributes(
    toolAttrs: ToolCallAttributes | MCPToolCallAttributes | undefined,
    attributes: Attributes,
  ): void {
    if (!toolAttrs) return;

    if (toolAttrs.toolId) {
      attributes['gen_ai.tool.name'] = toolAttrs.toolId;
      attributes[`${this.attributePrefix}tool.id`] = toolAttrs.toolId;
    }
    if ('source' in toolAttrs && toolAttrs.source) {
      attributes[`${this.attributePrefix}tool.source`] = toolAttrs.source as string;
    }
    if ('serverId' in toolAttrs && toolAttrs.serverId) {
      attributes[`${this.attributePrefix}mcp.server_id`] = toolAttrs.serverId as string;
    }
  }

  /**
   * Add agent-specific attributes
   */
  private addAgentAttributes(agentAttrs: AgentRunAttributes | undefined, attributes: Attributes): void {
    if (!agentAttrs) return;

    if (agentAttrs.agentId) {
      attributes[`${this.attributePrefix}agent.id`] = agentAttrs.agentId;
    }
    if (agentAttrs.instructions) {
      attributes[`${this.attributePrefix}agent.instructions`] = agentAttrs.instructions;
    }
    if (agentAttrs.availableTools) {
      attributes[`${this.attributePrefix}agent.available_tools`] = JSON.stringify(agentAttrs.availableTools);
    }
    if (agentAttrs.maxSteps) {
      attributes[`${this.attributePrefix}agent.max_steps`] = agentAttrs.maxSteps;
    }
  }

  /**
   * Add workflow-specific attributes
   */
  private addWorkflowAttributes(workflowAttrs: WorkflowRunAttributes | undefined, attributes: Attributes): void {
    if (!workflowAttrs) return;

    if (workflowAttrs.workflowId) {
      attributes[`${this.attributePrefix}workflow.id`] = workflowAttrs.workflowId;
    }
    if (workflowAttrs.status) {
      attributes[`${this.attributePrefix}workflow.status`] = workflowAttrs.status;
    }
  }

  /**
   * Add workflow step attributes
   */
  private addWorkflowStepAttributes(stepAttrs: WorkflowStepAttributes | undefined, attributes: Attributes): void {
    if (!stepAttrs) return;

    if (stepAttrs.stepId) {
      attributes[`${this.attributePrefix}workflow.step_id`] = stepAttrs.stepId;
    }
    if (stepAttrs.status) {
      attributes[`${this.attributePrefix}workflow.step_status`] = stepAttrs.status;
    }
  }
}
