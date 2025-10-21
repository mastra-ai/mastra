/**
 * LangSmith Exporter for Mastra AI Tracing
 *
 * This exporter sends tracing data to LangSmith for AI observability.
 * Root spans become top-level LangSmith RunTrees (no trace wrapper).
 * Events are handled as zero-duration RunTrees with matching start/end times.
 */

import type { AITracingEvent, AnyExportedAISpan, LLMGenerationAttributes } from '@mastra/core/ai-tracing';
import { AISpanType, omitKeys } from '@mastra/core/ai-tracing';
import { BaseAITracingExporter } from '@mastra/core/ai-tracing/exporters';
import type { BaseExporterConfig } from '@mastra/core/ai-tracing/exporters';
import { LogLevel } from '@mastra/core/logger';
import type { ClientConfig, RunTreeConfig } from 'langsmith';
import { Client, RunTree } from 'langsmith';
import type { KVMap } from 'langsmith/schemas';
import { normalizeUsageMetrics } from './metrics';

export interface LangSmithExporterConfig extends ClientConfig, BaseExporterConfig {
  /** LangSmith client instance */
  client?: Client;
}

type SpanData = {
  spans: Map<string, RunTree>; // Maps span.id to LangSmith RunTrees
  activeIds: Set<string>; // Tracks started (non-event) spans not yet ended, including root
};

// Default span type for all spans
const DEFAULT_SPAN_TYPE = 'chain';

// Exceptions to the default mapping
const SPAN_TYPE_EXCEPTIONS: Partial<Record<AISpanType, 'llm' | 'tool' | 'chain'>> = {
  [AISpanType.LLM_GENERATION]: 'llm',
  [AISpanType.LLM_CHUNK]: 'llm',
  [AISpanType.TOOL_CALL]: 'tool',
  [AISpanType.MCP_TOOL_CALL]: 'tool',
  [AISpanType.WORKFLOW_CONDITIONAL_EVAL]: 'chain',
  [AISpanType.WORKFLOW_WAIT_EVENT]: 'chain',
};

// Mapping function - returns valid LangSmith span types
function mapSpanType(spanType: AISpanType): 'llm' | 'tool' | 'chain' {
  return SPAN_TYPE_EXCEPTIONS[spanType] ?? DEFAULT_SPAN_TYPE;
}

function isKVMap(value: unknown): value is KVMap {
  return value != null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

export class LangSmithExporter extends BaseAITracingExporter {
  name = 'langsmith';
  private traceMap = new Map<string, SpanData>();
  private config: LangSmithExporterConfig;
  private client: Client;

  constructor(config: LangSmithExporterConfig) {
    // Map string log level to LogLevel enum for base class
    const logLevelMap: Record<string, LogLevel> = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
    };

    super({
      ...config,
      logLevel: config.logLevel ? logLevelMap[config.logLevel] : LogLevel.WARN,
    });

    config.apiKey = config.apiKey ?? process.env.LANGSMITH_API_KEY;

    if (!config.apiKey) {
      this.setDisabled(`Missing required credentials (apiKey: ${!!config.apiKey})`);
      this.config = null as any;
      this.client = null as any;
      return;
    }

    this.client = config.client ?? new Client(config);
    this.config = config;
  }

  async exportEvent(event: AITracingEvent): Promise<void> {
    if (!this.config) {
      return;
    }

    if (event.exportedSpan.isEvent) {
      await this.handleEventSpan(event.exportedSpan);
      return;
    }

    switch (event.type) {
      case 'span_started':
        await this.handleSpanStarted(event.exportedSpan);
        break;
      case 'span_updated':
        await this.handleSpanUpdateOrEnd(event.exportedSpan, false);
        break;
      case 'span_ended':
        await this.handleSpanUpdateOrEnd(event.exportedSpan, true);
        break;
    }
  }

  private initializeRootSpan(span: AnyExportedAISpan) {
    this.traceMap.set(span.traceId, { spans: new Map(), activeIds: new Set() });
  }

  private async handleSpanStarted(span: AnyExportedAISpan): Promise<void> {
    this.logger.debug('LangSmith exporter: handleSpanStarted', span.id, span.name);
    if (span.isRootSpan) {
      this.initializeRootSpan(span);
    }

    const method = 'handleSpanStarted';
    const spanData = this.getSpanData({ span, method });
    if (!spanData) {
      return;
    }

    // Refcount: track active non-event spans (including root)
    if (!span.isEvent) {
      spanData.activeIds.add(span.id);
    }

    const payload = {
      name: span.name,
      run_type: mapSpanType(span.type),
      ...this.buildRunTreePayload(span),
    };

    const langsmithParent = this.getLangSmithParent({ spanData, span, method });
    let langsmithRunTree: RunTree;
    if (!langsmithParent) {
      langsmithRunTree = new RunTree(payload);
    } else {
      langsmithRunTree = langsmithParent.createChild(payload);
    }

    spanData.spans.set(span.id, langsmithRunTree);

    await langsmithRunTree.postRun();
  }

  private async handleSpanUpdateOrEnd(span: AnyExportedAISpan, isEnd: boolean): Promise<void> {
    this.logger.debug('LangSmith exporter: handleSpanUpdateOrEnd', span.id, span.name, 'isEnd:', isEnd);
    const method = isEnd ? 'handleSpanEnd' : 'handleSpanUpdate';

    const spanData = this.getSpanData({ span, method });
    if (!spanData) {
      return;
    }

    const langsmithRunTree = spanData.spans.get(span.id);
    if (!langsmithRunTree) {
      this.logger.warn('LangSmith exporter: No LangSmith span found for span update/end', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        spanType: span.type,
        isRootSpan: span.isRootSpan,
        parentSpanId: span.parentSpanId,
        method,
      });
      return;
    }

    const updatePayload = this.buildRunTreePayload(span);
    langsmithRunTree.metadata = {
      ...langsmithRunTree.metadata,
      ...updatePayload.metadata,
    };
    if (updatePayload.inputs != null) {
      langsmithRunTree.inputs = updatePayload.inputs;
    }
    if (updatePayload.outputs != null) {
      langsmithRunTree.outputs = updatePayload.outputs;
    }
    if (updatePayload.error != null) {
      langsmithRunTree.error = updatePayload.error;
    }

    if (isEnd) {
      // End the span with the correct endTime (convert milliseconds to seconds)
      if (span.endTime) {
        await langsmithRunTree.end({ endTime: span.endTime.getTime() / 1000 });
      } else {
        await langsmithRunTree.end();
      }
      await langsmithRunTree.patchRun();

      // Refcount: mark this span as ended
      if (!span.isEvent) {
        spanData.activeIds.delete(span.id);
      }

      // If no more active spans remain for this trace, clean up the trace entry
      if (spanData.activeIds.size === 0) {
        this.traceMap.delete(span.traceId);
      }
    }
  }

  private async handleEventSpan(span: AnyExportedAISpan): Promise<void> {
    if (span.isRootSpan) {
      this.logger.debug('LangSmith exporter: Creating logger for event', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        method: 'handleEventSpan',
      });
      this.initializeRootSpan(span);
    }

    const method = 'handleEventSpan';
    const spanData = this.getSpanData({ span, method });
    if (!spanData) {
      return;
    }

    const langsmithParent = this.getLangSmithParent({ spanData, span, method });
    const payload = {
      ...this.buildRunTreePayload(span),
      name: span.name,
      type: mapSpanType(span.type),
      startTime: span.startTime.getTime() / 1000,
    };

    let langsmithRunTree: RunTree;
    if (!langsmithParent) {
      langsmithRunTree = new RunTree(payload);
    } else {
      langsmithRunTree = langsmithParent.createChild(payload);
    }

    await langsmithRunTree.postRun();

    await langsmithRunTree.end({ endTime: span.startTime.getTime() / 1000 });
    await langsmithRunTree.patchRun();
  }

  private getSpanData(options: { span: AnyExportedAISpan; method: string }): SpanData | undefined {
    const { span, method } = options;
    if (this.traceMap.has(span.traceId)) {
      return this.traceMap.get(span.traceId);
    }

    this.logger.warn('LangSmith exporter: No span data found for span', {
      traceId: span.traceId,
      spanId: span.id,
      spanName: span.name,
      spanType: span.type,
      isRootSpan: span.isRootSpan,
      parentSpanId: span.parentSpanId,
      method,
    });
  }

  private getLangSmithParent(options: {
    spanData: SpanData;
    span: AnyExportedAISpan;
    method: string;
  }): RunTree | undefined {
    const { spanData, span, method } = options;

    const parentId = span.parentSpanId;
    if (!parentId) {
      return undefined;
    }

    if (spanData.spans.has(parentId)) {
      return spanData.spans.get(parentId);
    }

    if (parentId && !spanData.spans.has(parentId)) {
      // This means the parent exists but isn't tracked as a LangSmith span,
      // which happens when the parent is the root span
      return undefined;
    }

    this.logger.warn('LangSmith exporter: No parent data found for span', {
      traceId: span.traceId,
      spanId: span.id,
      spanName: span.name,
      spanType: span.type,
      isRootSpan: span.isRootSpan,
      parentSpanId: span.parentSpanId,
      method,
    });
  }

  private buildRunTreePayload(span: AnyExportedAISpan): Partial<RunTreeConfig> {
    const payload: Partial<RunTreeConfig> & { metadata: KVMap } = {
      client: this.client,
      metadata: {
        mastra_span_type: span.type,
        ...span.metadata,
      },
    };

    // Core span data
    if (span.input !== undefined) {
      payload.inputs = isKVMap(span.input) ? span.input : { input: span.input };
    }

    if (span.output !== undefined) {
      payload.outputs = isKVMap(span.output) ? span.output : { output: span.output };
    }

    const attributes = (span.attributes ?? {}) as Record<string, any>;

    if (span.type === AISpanType.LLM_GENERATION) {
      const llmAttr = attributes as LLMGenerationAttributes;

      // See: https://docs.langchain.com/langsmith/log-llm-trace
      if (llmAttr.model !== undefined) {
        // Note - this should map to a model name recognized by LangSmith
        // eg “gpt-4o-mini”, “claude-3-opus-20240307”, etc.
        payload.metadata.ls_model_name = llmAttr.model;
      }

      // Provider goes to metadata (if provided by attributes)
      if (llmAttr.provider !== undefined) {
        // Note - this should map to a provider name recognized by
        // LangSmith eg “openai”, “anthropic”, etc.
        payload.metadata.ls_provider = llmAttr.provider;
      }

      // Usage/token info goes to metrics
      payload.metadata.usage_metadata = normalizeUsageMetrics(llmAttr);

      // Model parameters go to metadata
      if (llmAttr.parameters !== undefined) {
        payload.metadata.modelParameters = llmAttr.parameters;
      }

      // Other LLM attributes go to metadata
      const otherAttributes = omitKeys(attributes, ['model', 'usage', 'parameters']);
      payload.metadata = {
        ...payload.metadata,
        ...otherAttributes,
      };
    } else {
      // For non-LLM spans, put all attributes in metadata
      payload.metadata = {
        ...payload.metadata,
        ...attributes,
      };
    }

    // Handle errors
    if (span.errorInfo) {
      payload.error = span.errorInfo.message;
      payload.metadata.errorDetails = span.errorInfo;
    }

    return payload;
  }

  async shutdown(): Promise<void> {
    if (!this.config) {
      return;
    }

    // End all active spans
    for (const [_traceId, spanData] of this.traceMap) {
      for (const [_spanId, runTree] of spanData.spans) {
        await runTree.end();
        await runTree.patchRun();
      }
    }
    this.traceMap.clear();
    await super.shutdown();
  }
}
