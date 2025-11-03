/**
 * LangSmith Exporter for Mastra Tracing
 *
 * This exporter sends observability data to LangSmith
 * Root spans become top-level LangSmith RunTrees (no trace wrapper).
 * Events are handled as zero-duration RunTrees with matching start/end times.
 */

import type { TracingEvent, AnyExportedSpan, ModelGenerationAttributes } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import { BaseExporter } from '@mastra/observability';
import type { BaseExporterConfig } from '@mastra/observability';
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
const SPAN_TYPE_EXCEPTIONS: Partial<Record<SpanType, 'llm' | 'tool' | 'chain'>> = {
  [SpanType.MODEL_GENERATION]: 'llm',
  [SpanType.MODEL_CHUNK]: 'llm',
  [SpanType.TOOL_CALL]: 'tool',
  [SpanType.MCP_TOOL_CALL]: 'tool',
  [SpanType.WORKFLOW_CONDITIONAL_EVAL]: 'chain',
  [SpanType.WORKFLOW_WAIT_EVENT]: 'chain',
};

// Mapping function - returns valid LangSmith span types
function mapSpanType(spanType: SpanType): 'llm' | 'tool' | 'chain' {
  return SPAN_TYPE_EXCEPTIONS[spanType] ?? DEFAULT_SPAN_TYPE;
}

function isKVMap(value: unknown): value is KVMap {
  return value != null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

export class LangSmithExporter extends BaseExporter {
  name = 'langsmith';
  private traceMap = new Map<string, SpanData>();
  private config: LangSmithExporterConfig;
  private client: Client;

  constructor(config: LangSmithExporterConfig) {
    super(config);

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

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
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

  private initializeRootSpan(span: AnyExportedSpan) {
    this.traceMap.set(span.traceId, { spans: new Map(), activeIds: new Set() });
  }

  private async handleSpanStarted(span: AnyExportedSpan): Promise<void> {
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

  private async handleSpanUpdateOrEnd(span: AnyExportedSpan, isEnd: boolean): Promise<void> {
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

  private async handleEventSpan(span: AnyExportedSpan): Promise<void> {
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

  private getSpanData(options: { span: AnyExportedSpan; method: string }): SpanData | undefined {
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
    span: AnyExportedSpan;
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

  private buildRunTreePayload(span: AnyExportedSpan): Partial<RunTreeConfig> {
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

    if (span.type === SpanType.MODEL_GENERATION) {
      const modelAttr = attributes as ModelGenerationAttributes;

      // See: https://docs.langchain.com/langsmith/log-llm-trace
      if (modelAttr.model !== undefined) {
        // Note - this should map to a model name recognized by LangSmith
        // eg “gpt-4o-mini”, “claude-3-opus-20240307”, etc.
        payload.metadata.ls_model_name = modelAttr.model;
      }

      // Provider goes to metadata (if provided by attributes)
      if (modelAttr.provider !== undefined) {
        // Note - this should map to a provider name recognized by
        // LangSmith eg “openai”, “anthropic”, etc.
        payload.metadata.ls_provider = modelAttr.provider;
      }

      // Usage/token info goes to metrics
      payload.metadata.usage_metadata = normalizeUsageMetrics(modelAttr);

      // Model parameters go to metadata
      if (modelAttr.parameters !== undefined) {
        payload.metadata.modelParameters = modelAttr.parameters;
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
