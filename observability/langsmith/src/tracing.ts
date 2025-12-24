/**
 * LangSmith Exporter for Mastra Tracing
 *
 * This exporter sends observability data to LangSmith
 * Root spans become top-level LangSmith RunTrees (no trace wrapper).
 * Events are handled as zero-duration RunTrees with matching start/end times.
 */

import type { AnyExportedSpan, ModelGenerationAttributes } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import type { BaseTraceData, TrackingExporterConfig } from '@mastra/observability';
import { TrackingExporter } from '@mastra/observability';
import type { ClientConfig, RunTreeConfig } from 'langsmith';
import { Client, RunTree } from 'langsmith';
import type { KVMap } from 'langsmith/schemas';
import { formatUsageMetrics } from './metrics';

export interface LangSmithExporterConfig extends ClientConfig, TrackingExporterConfig {
  /** LangSmith client instance */
  client?: Client;
  /**
   * The name of the LangSmith project to send traces to.
   * Overrides the LANGCHAIN_PROJECT environment variable.
   * If neither is set, traces are sent to the "default" project.
   */
  projectName?: string;
}

interface LangSmithTraceData extends BaseTraceData {
  spans: Map<string, RunTree>;
}

// Default span type for all spans
const DEFAULT_SPAN_TYPE = 'chain';

// Exceptions to the default mapping
const SPAN_TYPE_EXCEPTIONS: Partial<Record<SpanType, 'llm' | 'tool' | 'chain'>> = {
  [SpanType.MODEL_GENERATION]: 'llm',
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

export class LangSmithExporter extends TrackingExporter<LangSmithTraceData, LangSmithExporterConfig> {
  name = 'langsmith';
  private client: Client;

  constructor(config: LangSmithExporterConfig) {
    super(config);

    config.apiKey = config.apiKey ?? process.env.LANGSMITH_API_KEY;

    if (!config.apiKey) {
      this.setDisabled(`Missing required credentials (apiKey: ${!!config.apiKey})`);
      this.client = null as any;
      return;
    }

    this.client = config.client ?? new Client(config);
  }

  // ==================== TrackingExporter Implementation ====================

  protected createTraceData(_span: AnyExportedSpan): LangSmithTraceData {
    return {
      activeSpanIds: new Set(),
      spans: new Map(),
    };
  }

  protected async handleSpanStarted(span: AnyExportedSpan, traceData: LangSmithTraceData): Promise<void> {
    this.logger.debug('LangSmith exporter: handleSpanStarted', span.id, span.name);

    const payload = {
      name: span.name,
      run_type: mapSpanType(span.type),
      ...this.buildRunTreePayload(span),
    };

    const langsmithParent = this.getLangSmithParent(traceData, span, 'handleSpanStarted');
    let langsmithRunTree: RunTree;
    if (!langsmithParent) {
      langsmithRunTree = new RunTree(payload);
    } else {
      langsmithRunTree = langsmithParent.createChild(payload);
    }

    traceData.spans.set(span.id, langsmithRunTree);

    await langsmithRunTree.postRun();
  }

  protected async handleSpanUpdated(span: AnyExportedSpan, traceData: LangSmithTraceData): Promise<void> {
    this.logger.debug('LangSmith exporter: handleSpanUpdated', span.id, span.name);

    const langsmithRunTree = traceData.spans.get(span.id);
    if (!langsmithRunTree) {
      this.logger.warn('LangSmith exporter: No LangSmith span found for span update', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        spanType: span.type,
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

    // Add new_token event for TTFT tracking on MODEL_GENERATION spans
    if (span.type === SpanType.MODEL_GENERATION) {
      const modelAttr = (span.attributes ?? {}) as ModelGenerationAttributes;
      if (modelAttr.completionStartTime !== undefined) {
        langsmithRunTree.addEvent({
          name: 'new_token',
          time: modelAttr.completionStartTime.toISOString(),
        });
      }
    }
  }

  protected async handleSpanEnded(span: AnyExportedSpan, traceData: LangSmithTraceData): Promise<void> {
    this.logger.debug('LangSmith exporter: handleSpanEnded', span.id, span.name);

    const langsmithRunTree = traceData.spans.get(span.id);
    if (!langsmithRunTree) {
      this.logger.warn('LangSmith exporter: No LangSmith span found for span end', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        spanType: span.type,
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

    // Add new_token event for TTFT tracking on MODEL_GENERATION spans
    if (span.type === SpanType.MODEL_GENERATION) {
      const modelAttr = (span.attributes ?? {}) as ModelGenerationAttributes;
      if (modelAttr.completionStartTime !== undefined) {
        langsmithRunTree.addEvent({
          name: 'new_token',
          time: modelAttr.completionStartTime.toISOString(),
        });
      }
    }

    // End the span with the correct endTime (convert milliseconds to seconds)
    if (span.endTime) {
      await langsmithRunTree.end({ endTime: span.endTime.getTime() / 1000 });
    } else {
      await langsmithRunTree.end();
    }
    await langsmithRunTree.patchRun();
  }

  protected async handleEventSpan(span: AnyExportedSpan, traceData: LangSmithTraceData): Promise<void> {
    this.logger.debug('LangSmith exporter: handleEventSpan', span.id, span.name);

    const langsmithParent = this.getLangSmithParent(traceData, span, 'handleEventSpan');
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

  protected async cleanupTraceData(traceData: LangSmithTraceData, _traceId: string): Promise<void> {
    // Only end spans that haven't been ended yet (still in activeSpanIds)
    // This handles shutdown scenarios where spans may not have received SPAN_ENDED events
    for (const spanId of traceData.activeSpanIds) {
      const runTree = traceData.spans.get(spanId);
      if (runTree) {
        await runTree.end();
        await runTree.patchRun();
      }
    }
  }

  // ==================== Helper Methods ====================

  private getLangSmithParent(
    traceData: LangSmithTraceData,
    span: AnyExportedSpan,
    method: string,
  ): RunTree | undefined {
    const parentId = span.parentSpanId;
    if (!parentId) {
      return undefined;
    }

    if (traceData.spans.has(parentId)) {
      return traceData.spans.get(parentId);
    }

    if (parentId && !traceData.spans.has(parentId)) {
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

    return undefined;
  }

  private buildRunTreePayload(span: AnyExportedSpan): Partial<RunTreeConfig> {
    const payload: Partial<RunTreeConfig> & { metadata: KVMap } = {
      client: this.client,
      metadata: {
        mastra_span_type: span.type,
        ...span.metadata,
      },
    };

    // Add project name if configured
    if (this.exporterConfig.projectName) {
      payload.project_name = this.exporterConfig.projectName;
    }

    // Add tags for root spans
    if (span.isRootSpan && span.tags?.length) {
      payload.tags = span.tags;
    }

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
        // eg "gpt-4o-mini", "claude-3-opus-20240307", etc.
        payload.metadata.ls_model_name = modelAttr.model;
      }

      // Provider goes to metadata (if provided by attributes)
      if (modelAttr.provider !== undefined) {
        // Note - this should map to a provider name recognized by
        // LangSmith eg "openai", "anthropic", etc.
        payload.metadata.ls_provider = modelAttr.provider;
      }

      // Usage/token info goes to metrics
      payload.metadata.usage_metadata = formatUsageMetrics(modelAttr.usage);

      // Model parameters go to metadata
      if (modelAttr.parameters !== undefined) {
        payload.metadata.modelParameters = modelAttr.parameters;
      }

      // Other LLM attributes go to metadata
      const otherAttributes = omitKeys(attributes, ['model', 'usage', 'parameters', 'completionStartTime']);
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
    if (!this.exporterConfig) {
      return;
    }
    await super.shutdown();
  }
}
