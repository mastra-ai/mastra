/**
 * LangSmith Exporter for Mastra Tracing
 *
 * This exporter sends observability data to LangSmith
 * Root spans become top-level LangSmith RunTrees (no trace wrapper).
 * Events are handled as zero-duration RunTrees with matching start/end times.
 */

import type { AnyExportedSpan, ModelGenerationAttributes, SpanErrorInfo } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import { TrackingExporter } from '@mastra/observability';
import type { TraceData, TrackingExporterConfig } from '@mastra/observability';
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

type LangSmithRoot = undefined;
type LangSmithSpan = RunTree;
type LangSmithEvent = RunTree;
type LangSmithMetadata = unknown;
type LangSmithTraceData = TraceData<LangSmithRoot, LangSmithSpan, LangSmithEvent, LangSmithMetadata>;

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

export class LangSmithExporter extends TrackingExporter<
  LangSmithRoot,
  LangSmithSpan,
  LangSmithEvent,
  LangSmithMetadata,
  LangSmithExporterConfig
> {
  override name = 'langsmith';
  #client: Client | undefined;

  constructor(config: LangSmithExporterConfig = {}) {
    // Resolve env vars BEFORE calling super (config is readonly in base class)
    const apiKey = config.apiKey ?? process.env.LANGSMITH_API_KEY;

    super({
      ...config,
      apiKey,
    });

    if (!apiKey) {
      this.setDisabled(`Missing required credentials (apiKey: ${!!apiKey})`);
      return;
    }

    this.#client = config.client ?? new Client(this.config);
  }

  protected override skipBuildRootTask = true;
  protected override async _buildRoot(_args: {
    span: AnyExportedSpan;
    traceData: LangSmithTraceData;
  }): Promise<LangSmithRoot | undefined> {
    throw new Error('Method not implemented.');
  }

  protected override async _buildSpan(args: {
    span: AnyExportedSpan;
    traceData: LangSmithTraceData;
  }): Promise<LangSmithSpan | undefined> {
    const { span, traceData } = args;

    const parent = span.isRootSpan ? undefined : traceData.getParent(args);

    if (!span.isRootSpan && !parent) {
      // parent doesn't exist and not creating rootSpan, return early data
      return;
    }

    const payload = {
      name: span.name,
      ...this.buildRunTreePayload(span, true),
    };

    const langSmithSpan = span.isRootSpan ? new RunTree(payload) : parent!.createChild(payload);

    await langSmithSpan.postRun();
    return langSmithSpan;
  }

  protected override async _buildEvent(args: {
    span: AnyExportedSpan;
    traceData: LangSmithTraceData;
  }): Promise<LangSmithEvent | undefined> {
    const langSmithSpan = await this._buildSpan(args);

    if (!langSmithSpan) {
      // parent doesn't exist and not creating rootSpan, return early data
      return;
    }

    // use start-time as end-time to make an event span.
    await langSmithSpan.end({ endTime: args.span.startTime.getTime() });
    await langSmithSpan.patchRun();
    return langSmithSpan;
  }

  protected override async _updateSpan(args: { span: AnyExportedSpan; traceData: LangSmithTraceData }): Promise<void> {
    await this.handleSpanUpdateOrEnd({ ...args, isEnd: false });
  }

  protected override async _finishSpan(args: { span: AnyExportedSpan; traceData: LangSmithTraceData }): Promise<void> {
    await this.handleSpanUpdateOrEnd({ ...args, isEnd: true });
  }

  protected override async _abortSpan(args: {
    span: LangSmithSpan;
    traceData: LangSmithTraceData;
    reason: SpanErrorInfo;
  }): Promise<void> {
    const { span, reason } = args;
    span.error = reason.message;
    span.metadata = {
      ...span.metadata,
      errorDetails: reason,
    };
    await span.end();
    await span.patchRun();
  }

  private async handleSpanUpdateOrEnd(args: {
    span: AnyExportedSpan;
    traceData: LangSmithTraceData;
    isEnd: boolean;
  }): Promise<void> {
    const { span, traceData, isEnd } = args;

    const langSmithSpan = traceData.getSpan({ spanId: span.id });
    if (!langSmithSpan) {
      //update occurred before span start, return early data
      return;
    }

    const updatePayload = this.buildRunTreePayload(span);

    langSmithSpan.metadata = {
      ...langSmithSpan.metadata,
      ...updatePayload.metadata,
    };
    if (updatePayload.inputs != null) {
      langSmithSpan.inputs = updatePayload.inputs;
    }
    if (updatePayload.outputs != null) {
      langSmithSpan.outputs = updatePayload.outputs;
    }
    if (updatePayload.error != null) {
      langSmithSpan.error = updatePayload.error;
    }

    // Add new_token event for TTFT tracking on MODEL_GENERATION spans
    if (span.type === SpanType.MODEL_GENERATION) {
      const modelAttr = (span.attributes ?? {}) as ModelGenerationAttributes;
      if (modelAttr.completionStartTime !== undefined) {
        langSmithSpan.addEvent({
          name: 'new_token',
          time: modelAttr.completionStartTime.toISOString(),
        });
      }
    }

    if (isEnd) {
      // End the span with the correct endTime
      if (span.endTime) {
        await langSmithSpan.end({ endTime: span.endTime.getTime() });
      } else {
        await langSmithSpan.end();
      }
    }
    await langSmithSpan.patchRun();
  }

  private buildRunTreePayload(span: AnyExportedSpan, isNew = false): Partial<RunTreeConfig> {
    const payload: Partial<RunTreeConfig> & { metadata: KVMap } = {
      client: this.#client,
      metadata: {
        mastra_span_type: span.type,
        ...span.metadata,
      },
    };

    if (isNew) {
      payload.run_type = mapSpanType(span.type);
      payload.start_time = span.startTime.getTime();
    }

    // Add project name if configured
    if (this.config.projectName) {
      payload.project_name = this.config.projectName;
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
      payload.metadata.usage_metadata = formatUsageMetrics(modelAttr.usage);

      // Model parameters go to metadata
      if (modelAttr.parameters !== undefined) {
        payload.metadata.modelParameters = modelAttr.parameters;
      }

      // Other LLM attributes go to metadata
      const otherAttributes = omitKeys(attributes, ['model', 'provider', 'usage', 'parameters', 'completionStartTime']);
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
}
