/**
 * Sentry Exporter for Mastra Observability
 *
 * Sends observability data to Sentry for AI tracing and monitoring.
 * Uses Sentry's modern span model (v8+) with OpenTelemetry semantic conventions.
 *
 * Spans are hierarchically organized: AGENT_RUN -> MODEL_GENERATION -> TOOL_CALL
 * MODEL_STEP and MODEL_CHUNK spans are skipped to simplify the trace hierarchy.
 */

import type {
  TracingEvent,
  AnyExportedSpan,
  ModelGenerationAttributes,
  ToolCallAttributes,
  AgentRunAttributes,
  WorkflowRunAttributes,
  WorkflowStepAttributes,
  UsageStats,
} from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { BaseExporterConfig } from '@mastra/observability';
import { BaseExporter } from '@mastra/observability';
import { getAttributes as getGenAIAttributes, getSpanName as getGenAISpanName } from '@mastra/otel-exporter';
import * as Sentry from '@sentry/node';

const SPAN_TYPE_CONFIG: Record<SpanType, { opType: string; opName: string }> = {
  [SpanType.AGENT_RUN]: { opType: 'gen_ai.invoke_agent', opName: 'invoke_agent' },
  [SpanType.MODEL_GENERATION]: { opType: 'gen_ai.chat', opName: 'chat' },
  [SpanType.TOOL_CALL]: { opType: 'gen_ai.execute_tool', opName: 'execute_tool' },
  [SpanType.MCP_TOOL_CALL]: { opType: 'gen_ai.execute_tool', opName: 'execute_tool' },
  [SpanType.WORKFLOW_RUN]: { opType: 'workflow.run', opName: 'workflow' },
  [SpanType.WORKFLOW_STEP]: { opType: 'workflow.step', opName: 'step' },
  [SpanType.WORKFLOW_CONDITIONAL]: { opType: 'workflow.conditional', opName: 'step' },
  [SpanType.WORKFLOW_CONDITIONAL_EVAL]: { opType: 'workflow.conditional', opName: 'step' },
  [SpanType.WORKFLOW_PARALLEL]: { opType: 'workflow.parallel', opName: 'step' },
  [SpanType.WORKFLOW_LOOP]: { opType: 'workflow.loop', opName: 'step' },
  [SpanType.WORKFLOW_SLEEP]: { opType: 'workflow.sleep', opName: 'step' },
  [SpanType.WORKFLOW_WAIT_EVENT]: { opType: 'workflow.wait', opName: 'step' },
  [SpanType.PROCESSOR_RUN]: { opType: 'ai.processor', opName: 'step' },
  [SpanType.GENERIC]: { opType: 'ai.span', opName: 'span' },
  [SpanType.MODEL_STEP]: { opType: 'ai.span', opName: 'step' },
  [SpanType.MODEL_CHUNK]: { opType: 'ai.span', opName: 'step' },
};

const ATTRIBUTE_KEYS = {
  SPAN_TYPE: 'ai.span.type',
  ORIGIN: 'sentry.origin',
  TAGS: 'tags',
  INPUT: 'input',
  OUTPUT: 'output',
  GEN_AI_REQUEST_STREAM: 'gen_ai.request.stream',
  GEN_AI_RESPONSE_MODEL: 'gen_ai.response.model',
  GEN_AI_RESPONSE_STREAMING: 'gen_ai.response.streaming',
  GEN_AI_RESPONSE_TOOL_CALLS: 'gen_ai.response.tool_calls',
  GEN_AI_RESPONSE_TEXT: 'gen_ai.response.text',
  GEN_AI_COMPLETION_START_TIME: 'gen_ai.completion_start_time',
  GEN_AI_TOOL_CALL_ID: 'gen_ai.tool.call.id',
  TOOL_SUCCESS: 'tool.success',
  GEN_AI_PIPELINE_NAME: 'gen_ai.pipeline.name',
  GEN_AI_AGENT_PROMPT: 'gen_ai.agent.prompt',
  WORKFLOW_ID: 'workflow.id',
  WORKFLOW_STATUS: 'workflow.status',
  WORKFLOW_STEP_ID: 'workflow.step.id',
  WORKFLOW_STEP_STATUS: 'workflow.step.status',
  GEN_AI_USAGE_INPUT_TOKENS: 'gen_ai.usage.input_tokens',
  GEN_AI_USAGE_OUTPUT_TOKENS: 'gen_ai.usage.output_tokens',
  GEN_AI_USAGE_TOTAL_TOKENS: 'gen_ai.usage.total_tokens',
  GEN_AI_USAGE_CACHE_READ_TOKENS: 'gen_ai.usage.cache_read_input_tokens',
  GEN_AI_USAGE_CACHE_WRITE_TOKENS: 'gen_ai.usage.cache_write_input_tokens',
  GEN_AI_USAGE_REASONING_TOKENS: 'gen_ai.usage.reasoning_tokens',
} as const;

export interface SentryExporterConfig extends BaseExporterConfig {
  // Sentry SDK options (passed to Sentry.init())
  /** Data Source Name - tells the SDK where to send events */
  dsn?: string;
  /** Deployment environment (enables filtering issues and alerts by environment) */
  environment?: string;
  /** Percentage of transactions sent to Sentry (0.0 = 0%, 1.0 = 100%) */
  tracesSampleRate?: number;
  /** Version of your code deployed (helps identify regressions and track deployments) */
  release?: string;
  /** Additional Sentry SDK options (integrations, beforeSend, etc.) */
  options?: Partial<Sentry.NodeOptions>;
}

/**
 * Internal span tracking data.
 * generation tracks the single MODEL_GENERATION for AGENT_RUN response attributes.
 * toolCalls tracks child tool calls for MODEL_GENERATION spans.
 */
type SpanData = {
  span: Sentry.Span;
  spanType: SpanType;
  generation?: {
    model?: string;
    output?: any;
    usage?: UsageStats;
  };
  toolCalls?: Array<{
    name: string;
    id?: string;
    type?: string;
  }>;
};

/** Config type with Sentry-specific fields resolved */
type ResolvedSentryConfig = Required<
  Pick<SentryExporterConfig, 'dsn' | 'environment' | 'tracesSampleRate' | 'release'>
>;

export class SentryExporter extends BaseExporter {
  name = 'sentry';
  private sentryConfig: ResolvedSentryConfig;
  private spanMap = new Map<string, SpanData>();
  private skippedSpans = new Map<string, string>();
  private initialized = false;

  constructor(config: SentryExporterConfig = {}) {
    super(config);

    this.sentryConfig = {
      dsn: config.dsn ?? process.env.SENTRY_DSN ?? '',
      environment: config.environment ?? process.env.SENTRY_ENVIRONMENT ?? 'production',
      tracesSampleRate: config.tracesSampleRate ?? 1.0,
      release: config.release ?? process.env.SENTRY_RELEASE ?? '',
    };

    if (!this.sentryConfig.dsn) {
      const dsnSource = config.dsn ? 'from config' : process.env.SENTRY_DSN ? 'from env' : 'missing';
      this.setDisabled(
        `Missing required DSN (dsn: ${dsnSource}). Set SENTRY_DSN environment variable or pass it in config.`,
      );
      return;
    }

    try {
      Sentry.init({
        dsn: this.sentryConfig.dsn,
        environment: this.sentryConfig.environment,
        tracesSampleRate: this.sentryConfig.tracesSampleRate,
        release: this.sentryConfig.release,
        ...config.options,
      });
      this.initialized = true;
    } catch (error) {
      this.setDisabled(`Failed to initialize Sentry: ${error}`);
    }
  }

  // ============================================================================
  // Main Event Handlers
  // ============================================================================

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (!this.initialized) return;

    const { type, exportedSpan } = event;

    if (exportedSpan.isEvent) {
      this.handleEventSpan(exportedSpan);
      return;
    }

    // Skip MODEL_CHUNK and MODEL_STEP spans to simplify trace hierarchy.
    // We store them in skippedSpans to preserve parent-child relationships:
    // when a child span references a skipped span as parent, resolveParentSpanId()
    // walks up the chain to find the first non-skipped ancestor.
    if (exportedSpan.type === SpanType.MODEL_CHUNK || exportedSpan.type === SpanType.MODEL_STEP) {
      if (type === TracingEventType.SPAN_STARTED) {
        this.skippedSpans.set(exportedSpan.id, exportedSpan.parentSpanId || '');
      } else if (type === TracingEventType.SPAN_ENDED) {
        this.skippedSpans.delete(exportedSpan.id);
      }
      return;
    }

    switch (type) {
      case TracingEventType.SPAN_STARTED:
        await this.handleSpanStarted(exportedSpan);
        break;
      case TracingEventType.SPAN_UPDATED:
        await this.handleSpanUpdated(exportedSpan);
        break;
      case TracingEventType.SPAN_ENDED:
        await this.handleSpanEnded(exportedSpan);
        break;
    }
  }

  private handleEventSpan(span: AnyExportedSpan): void {
    Sentry.addBreadcrumb({
      type: 'default',
      category: span.type,
      message: span.name,
      level: span.errorInfo ? 'error' : 'info',
      data: {
        spanId: span.id,
        traceId: span.traceId,
        ...(span.input && { input: this.serializeValue(span.input) }),
        ...(span.output && { output: this.serializeValue(span.output) }),
        ...(span.metadata && { metadata: span.metadata }),
        ...(span.attributes && { attributes: span.attributes }),
      },
      timestamp: span.startTime.getTime() / 1000,
    });
  }

  private async handleSpanStarted(span: AnyExportedSpan): Promise<void> {
    const resolvedParentId = this.resolveParentSpanId(span.parentSpanId);

    const sentrySpan = Sentry.startInactiveSpan({
      op: this.getOperationType(span),
      name: getGenAISpanName(span),
      startTime: span.startTime.getTime(),
      forceTransaction: span.isRootSpan,
      parentSpan: resolvedParentId ? this.spanMap.get(resolvedParentId)?.span : undefined,
    });

    sentrySpan.setAttributes(this.buildSpanAttributes(span));

    this.spanMap.set(span.id, {
      span: sentrySpan,
      spanType: span.type,
    });

    // Track tool calls as children of MODEL_GENERATION spans for gen_ai.response.tool_calls attribute
    if (span.type === SpanType.TOOL_CALL && resolvedParentId) {
      this.trackToolCallForParent(span, resolvedParentId);
    }
  }

  private async handleSpanUpdated(span: AnyExportedSpan): Promise<void> {
    const spanData = this.spanMap.get(span.id);
    if (!spanData) {
      this.logMissingSpan(span, 'span update');
      return;
    }
    // Attributes are set on SPAN_STARTED and finalized on SPAN_ENDED.
    // If dynamic updates become necessary, add spanData.span.setAttributes() here.
  }

  private async handleSpanEnded(span: AnyExportedSpan): Promise<void> {
    const spanData = this.spanMap.get(span.id);
    if (!spanData) {
      this.logMissingSpan(span, 'span end');
      return;
    }

    const { span: sentrySpan } = spanData;

    sentrySpan.setAttributes(this.buildSpanAttributes(span));

    if (span.type === SpanType.MODEL_GENERATION) {
      // Set gen_ai.response.tool_calls if this generation had tool calls
      this.applyToolCallsAttribute(spanData);

      const resolvedParentId = this.resolveParentSpanId(span.parentSpanId);
      if (resolvedParentId) {
        const parentData = this.spanMap.get(resolvedParentId);
        if (parentData?.spanType === SpanType.AGENT_RUN) {
          const modelAttr = span.attributes as ModelGenerationAttributes;
          parentData.generation = {
            model: modelAttr.model,
            output: span.output,
            usage: modelAttr.usage,
          };
        }
      }
    }

    if (span.type === SpanType.AGENT_RUN) {
      // Apply token usage from the single child MODEL_GENERATION span
      // (there is only ever one MODEL_GENERATION span per AGENT_RUN)
      this.applyUsageFromGeneration(spanData);

      this.setGenerationResponseAttributes(spanData);
    }

    if (span.errorInfo) {
      sentrySpan.setStatus({
        code: 2,
        message: span.errorInfo.message,
      });

      Sentry.captureException(span.errorInfo.message, {
        contexts: {
          trace: { trace_id: span.traceId, span_id: span.id },
          span_info: {
            name: span.name,
            type: span.type,
            error_id: span.errorInfo.id,
            error_category: span.errorInfo.category,
          },
        },
      });
    }

    const endTime = span.endTime ? span.endTime.getTime() : undefined;
    sentrySpan.end(endTime);
    this.spanMap.delete(span.id);
  }

  // ============================================================================
  // Span Creation Helpers
  // ============================================================================

  private resolveParentSpanId(parentSpanId: string | undefined): string | undefined {
    if (!parentSpanId) return undefined;

    let currentParentId: string | undefined = parentSpanId;
    while (currentParentId && this.skippedSpans.has(currentParentId)) {
      currentParentId = this.skippedSpans.get(currentParentId);
      if (!currentParentId) break;
    }

    return currentParentId;
  }

  private getOperationType(span: AnyExportedSpan): string {
    const config = SPAN_TYPE_CONFIG[span.type];
    return config ? config.opType : 'ai.span';
  }

  private buildSpanAttributes(span: AnyExportedSpan): Record<string, any> {
    const attributes = getGenAIAttributes(span) as Record<string, any>;

    attributes[ATTRIBUTE_KEYS.SPAN_TYPE] = span.type;
    attributes[ATTRIBUTE_KEYS.ORIGIN] = 'auto.ai.mastra';

    if (span.metadata) {
      Object.entries(span.metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null && key !== 'langfuse') {
          attributes[`metadata.${key}`] = this.serializeValue(value);
        }
      });
    }

    this.setAttributeIfDefined(attributes, ATTRIBUTE_KEYS.TAGS, span.tags?.join(','));

    this.addInputOutputAttributes(attributes, span);

    if (span.type === SpanType.MODEL_GENERATION) {
      this.addModelGenerationAttributes(attributes, span);
    }

    if (span.type === SpanType.TOOL_CALL) {
      this.addToolCallAttributes(attributes, span);
    }

    if (span.type === SpanType.AGENT_RUN) {
      this.addAgentRunAttributes(attributes, span);
    }

    if (span.type === SpanType.WORKFLOW_RUN) {
      const workflowAttr = span.attributes as WorkflowRunAttributes;
      this.setAttributeIfDefined(attributes, ATTRIBUTE_KEYS.WORKFLOW_ID, this.getEntityName(span));
      this.setAttributeIfDefined(attributes, ATTRIBUTE_KEYS.WORKFLOW_STATUS, workflowAttr.status);
    }

    if (span.type === SpanType.WORKFLOW_STEP) {
      const stepAttr = span.attributes as WorkflowStepAttributes;
      this.setAttributeIfDefined(attributes, ATTRIBUTE_KEYS.WORKFLOW_STEP_ID, this.getEntityName(span));
      this.setAttributeIfDefined(attributes, ATTRIBUTE_KEYS.WORKFLOW_STEP_STATUS, stepAttr.status);
    }

    return attributes;
  }

  // ============================================================================
  // Sentry-Specific Attribute Formatters
  // ============================================================================

  /**
   * Adds Sentry-specific input/output attributes that complement GenAI semantic conventions.
   * Adds 'input' and 'output' keys for Sentry UI compatibility.
   */
  private addInputOutputAttributes(attributes: Record<string, any>, span: AnyExportedSpan): void {
    if (span.input !== undefined) {
      attributes[ATTRIBUTE_KEYS.INPUT] = this.serializeValue(span.input);
    }

    if (span.output !== undefined) {
      attributes[ATTRIBUTE_KEYS.OUTPUT] = this.serializeValue(span.output);

      // Extract text for MODEL_GENERATION spans
      if (span.type === SpanType.MODEL_GENERATION) {
        const outputText = this.extractOutputText(span.output);
        if (outputText) {
          attributes[ATTRIBUTE_KEYS.GEN_AI_RESPONSE_TEXT] = outputText;
        }
      }
    }
  }

  /**
   * Adds Sentry-specific MODEL_GENERATION attributes that complement GenAI semantic conventions.
   */
  private addModelGenerationAttributes(attributes: Record<string, any>, span: AnyExportedSpan): void {
    const modelAttr = span.attributes as ModelGenerationAttributes;

    if (modelAttr.streaming !== undefined) {
      attributes[ATTRIBUTE_KEYS.GEN_AI_REQUEST_STREAM] = modelAttr.streaming;
      attributes[ATTRIBUTE_KEYS.GEN_AI_RESPONSE_STREAMING] = modelAttr.streaming;
    }

    this.setAttributeIfDefined(
      attributes,
      ATTRIBUTE_KEYS.GEN_AI_COMPLETION_START_TIME,
      modelAttr.completionStartTime?.toISOString(),
    );

    if (modelAttr.usage) {
      const totalTokens = (modelAttr.usage.inputTokens || 0) + (modelAttr.usage.outputTokens || 0);
      if (totalTokens > 0) {
        attributes[ATTRIBUTE_KEYS.GEN_AI_USAGE_TOTAL_TOKENS] = totalTokens;
      }
    }
  }

  /**
   * Adds Sentry-specific TOOL_CALL attributes that complement GenAI semantic conventions.
   */
  private addToolCallAttributes(attributes: Record<string, any>, span: AnyExportedSpan): void {
    const toolAttr = span.attributes as ToolCallAttributes;

    this.setAttributeIfDefined(attributes, ATTRIBUTE_KEYS.TOOL_SUCCESS, toolAttr.success);
    this.setAttributeIfDefined(attributes, ATTRIBUTE_KEYS.GEN_AI_TOOL_CALL_ID, span.metadata?.toolCallId);
  }

  /**
   * Adds Sentry-specific AGENT_RUN attributes that complement GenAI semantic conventions.
   */
  private addAgentRunAttributes(attributes: Record<string, any>, span: AnyExportedSpan): void {
    const agentAttr = span.attributes as AgentRunAttributes;

    const agentName = this.getEntityName(span);
    if (agentName) {
      attributes[ATTRIBUTE_KEYS.GEN_AI_PIPELINE_NAME] = agentName;
    }

    this.setAttributeIfDefined(attributes, ATTRIBUTE_KEYS.GEN_AI_AGENT_PROMPT, agentAttr.prompt);
  }

  // ============================================================================
  // Token Usage Management
  // ============================================================================

  /**
   * Applies token usage from the MODEL_GENERATION span to the AGENT_RUN span attributes.
   * Reads usage directly from the generation field.
   * Called when AGENT_RUN spans end to set gen_ai.usage.* attributes.
   */
  private applyUsageFromGeneration(spanData: SpanData): void {
    const usage = spanData.generation?.usage;
    if (!usage) return;

    const inputTokens = usage.inputTokens || 0;
    const outputTokens = usage.outputTokens || 0;

    if (inputTokens > 0) {
      spanData.span.setAttribute(ATTRIBUTE_KEYS.GEN_AI_USAGE_INPUT_TOKENS, inputTokens);
    }
    if (outputTokens > 0) {
      spanData.span.setAttribute(ATTRIBUTE_KEYS.GEN_AI_USAGE_OUTPUT_TOKENS, outputTokens);
    }

    const totalTokens = inputTokens + outputTokens;
    if (totalTokens > 0) {
      spanData.span.setAttribute(ATTRIBUTE_KEYS.GEN_AI_USAGE_TOTAL_TOKENS, totalTokens);
    }

    const cacheReadTokens = usage.inputDetails?.cacheRead || 0;
    const cacheWriteTokens = usage.inputDetails?.cacheWrite || 0;
    const reasoningTokens = usage.outputDetails?.reasoning || 0;

    if (cacheReadTokens > 0) {
      spanData.span.setAttribute(ATTRIBUTE_KEYS.GEN_AI_USAGE_CACHE_READ_TOKENS, cacheReadTokens);
    }
    if (cacheWriteTokens > 0) {
      spanData.span.setAttribute(ATTRIBUTE_KEYS.GEN_AI_USAGE_CACHE_WRITE_TOKENS, cacheWriteTokens);
    }
    if (reasoningTokens > 0) {
      spanData.span.setAttribute(ATTRIBUTE_KEYS.GEN_AI_USAGE_REASONING_TOKENS, reasoningTokens);
    }
  }

  /**
   * Sets gen_ai.response.model and gen_ai.response.text from the MODEL_GENERATION.
   * Only applies to AGENT_RUN spans.
   */
  private setGenerationResponseAttributes(spanData: SpanData): void {
    if (!spanData.generation) return;

    if (spanData.generation.model) {
      spanData.span.setAttribute(ATTRIBUTE_KEYS.GEN_AI_RESPONSE_MODEL, spanData.generation.model);
    }

    if (spanData.generation.output) {
      const outputText = this.extractOutputText(spanData.generation.output);
      if (outputText) {
        spanData.span.setAttribute(ATTRIBUTE_KEYS.GEN_AI_RESPONSE_TEXT, outputText);
      }
    }
  }

  /**
   * Tracks a TOOL_CALL span as a child of its parent MODEL_GENERATION span.
   * This builds the tool_calls array for gen_ai.response.tool_calls attribute.
   */
  private trackToolCallForParent(span: AnyExportedSpan, parentId: string): void {
    const parentSpanData = this.spanMap.get(parentId);
    if (!parentSpanData || parentSpanData.spanType !== SpanType.MODEL_GENERATION) {
      return;
    }

    const toolAttr = span.attributes as ToolCallAttributes;
    if (!parentSpanData.toolCalls) {
      parentSpanData.toolCalls = [];
    }

    parentSpanData.toolCalls.push({
      name: this.getEntityName(span),
      id: span.metadata?.toolCallId,
      type: toolAttr.toolType || 'function',
    });
  }

  /**
   * Applies the gen_ai.response.tool_calls attribute to MODEL_GENERATION spans.
   * Called when MODEL_GENERATION spans end if they have child tool calls.
   */
  private applyToolCallsAttribute(spanData: SpanData): void {
    if (!spanData.toolCalls || spanData.toolCalls.length === 0) {
      return;
    }

    spanData.span.setAttribute(ATTRIBUTE_KEYS.GEN_AI_RESPONSE_TOOL_CALLS, JSON.stringify(spanData.toolCalls));
  }

  // ============================================================================
  // Utility Helpers
  // ============================================================================

  private logMissingSpan(span: AnyExportedSpan, operation: string): void {
    this.logger.warn(`Sentry exporter: No Sentry span found for ${operation}`, {
      traceId: span.traceId,
      spanId: span.id,
      spanName: span.name,
    });
  }

  private getEntityName(span: AnyExportedSpan): string {
    return span.entityName || span.entityId || 'unknown';
  }

  private extractOutputText(output: any): string | undefined {
    if (!output) return undefined;
    if (typeof output === 'string') return output;
    if (output.text && typeof output.text === 'string') return output.text;
    if (output.content && typeof output.content === 'string') return output.content;
    if (output.message?.content && typeof output.message.content === 'string') return output.message.content;
    return undefined;
  }

  private serializeValue(value: any): any {
    if (value === null || value === undefined) return value;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return value;
  }

  private setAttributeIfDefined(attributes: Record<string, any>, key: string, value: any): void {
    if (value !== undefined && value !== null) {
      attributes[key] = value;
    }
  }

  // ============================================================================
  // Flush and Shutdown
  // ============================================================================

  /**
   * Force flush any buffered spans without shutting down the exporter.
   * This is useful in serverless environments where you need to ensure spans
   * are exported before the runtime instance is terminated.
   */
  async flush(): Promise<void> {
    if (!this.initialized) return;

    try {
      // Sentry.flush() sends any pending events to Sentry
      // The timeout is in milliseconds
      await Sentry.flush(2000);
      this.logger.debug('Sentry exporter: Flushed pending events');
    } catch (error) {
      this.logger.error('Sentry exporter: Error flushing events', { error });
    }
  }

  async shutdown(): Promise<void> {
    for (const [spanId, spanData] of this.spanMap.entries()) {
      try {
        spanData.span.end();
      } catch (error) {
        this.logger.error('Sentry exporter: Error ending span during shutdown', { spanId, error });
      }
    }

    this.spanMap.clear();
    this.skippedSpans.clear();

    if (this.initialized) {
      await Sentry.close(2000);
    }

    await super.shutdown();
  }
}
