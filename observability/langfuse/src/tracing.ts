/**
 * Langfuse Exporter for Mastra Observability
 *
 * This exporter sends observability data to Langfuse.
 * Root spans start traces in Langfuse.
 * MODEL_GENERATION spans become Langfuse generations, all others become spans.
 */

import type { AnyExportedSpan, ModelGenerationAttributes, UsageStats } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import type { BaseTraceData, TrackingExporterConfig } from '@mastra/observability';
import { TrackingExporter } from '@mastra/observability';
import { Langfuse } from 'langfuse';
import type { LangfuseTraceClient, LangfuseSpanClient, LangfuseGenerationClient, LangfuseEventClient } from 'langfuse';

export interface LangfuseExporterConfig extends TrackingExporterConfig {
  /** Langfuse API key */
  publicKey?: string;
  /** Langfuse secret key */
  secretKey?: string;
  /** Langfuse host URL */
  baseUrl?: string;
  /** Enable realtime mode - flushes after each event for immediate visibility */
  realtime?: boolean;
  /** Additional options to pass to the Langfuse client */
  options?: any;
}

type LangfusePromptData = { name?: string; version?: number; id?: string };

type SpanMetadata = {
  parentSpanId?: string;
  langfusePrompt?: LangfusePromptData;
};

interface LangfuseTraceData extends BaseTraceData {
  trace: LangfuseTraceClient;
  spans: Map<string, LangfuseSpanClient | LangfuseGenerationClient>;
  spanMetadata: Map<string, SpanMetadata>;
  events: Map<string, LangfuseEventClient>;
  rootSpanId?: string;
}

type LangfuseParent = LangfuseTraceClient | LangfuseSpanClient | LangfuseGenerationClient | LangfuseEventClient;

/**
 * Token usage format compatible with Langfuse.
 */
export interface LangfuseUsageMetrics {
  input?: number;
  output?: number;
  total?: number;
  reasoning?: number;
  cache_read_input_tokens?: number;
  cache_write_input_tokens?: number;
}

/**
 * Formats UsageStats to Langfuse's expected format.
 */
export function formatUsageMetrics(usage?: UsageStats): LangfuseUsageMetrics {
  if (!usage) return {};

  const metrics: LangfuseUsageMetrics = {};

  if (usage.inputTokens !== undefined) {
    metrics.input = usage.inputTokens;

    if (usage.inputDetails?.cacheWrite !== undefined) {
      metrics.cache_write_input_tokens = usage.inputDetails.cacheWrite;
      metrics.input -= metrics.cache_write_input_tokens;
    }
  }

  if (usage.inputDetails?.cacheRead !== undefined) {
    metrics.cache_read_input_tokens = usage.inputDetails.cacheRead;
  }

  if (usage.outputTokens !== undefined) {
    metrics.output = usage.outputTokens;
  }

  if (usage.outputDetails?.reasoning !== undefined) {
    metrics.reasoning = usage.outputDetails.reasoning;
  }

  if (metrics.input && metrics.output) {
    metrics.total = metrics.input + metrics.output;
    if (metrics.cache_write_input_tokens) {
      metrics.total += metrics.cache_write_input_tokens;
    }
  }

  return metrics;
}

export class LangfuseExporter extends TrackingExporter<LangfuseTraceData, LangfuseExporterConfig> {
  name = 'langfuse';
  private client: Langfuse;
  private realtime: boolean;

  constructor(config: LangfuseExporterConfig) {
    super(config);

    this.realtime = config.realtime ?? false;

    if (!config.publicKey || !config.secretKey) {
      this.setDisabled(
        `Missing required credentials (publicKey: ${!!config.publicKey}, secretKey: ${!!config.secretKey})`,
      );
      // Create a no-op client to prevent runtime errors
      this.client = null as any;
      return;
    }

    this.client = new Langfuse({
      publicKey: config.publicKey,
      secretKey: config.secretKey,
      baseUrl: config.baseUrl,
      ...config.options,
    });
  }

  // ==================== TrackingExporter Implementation ====================

  protected createTraceData(span: AnyExportedSpan): LangfuseTraceData {
    const trace = this.client.trace(this.buildTracePayload(span));

    // Extract langfuse prompt data from root span
    const langfuseData = span.metadata?.langfuse as { prompt?: LangfusePromptData } | undefined;
    const spanMetadata = new Map<string, SpanMetadata>();

    // Store root span metadata for prompt inheritance
    spanMetadata.set(span.id, {
      parentSpanId: undefined,
      langfusePrompt: langfuseData?.prompt,
    });

    return {
      activeSpanIds: new Set(),
      trace,
      spans: new Map(),
      spanMetadata,
      events: new Map(),
      rootSpanId: span.id,
    };
  }

  protected async handleSpanStarted(span: AnyExportedSpan, traceData: LangfuseTraceData): Promise<void> {
    // Store span metadata for prompt inheritance lookup (for non-root spans)
    if (!span.isRootSpan) {
      const langfuseData = span.metadata?.langfuse as { prompt?: LangfusePromptData } | undefined;
      traceData.spanMetadata.set(span.id, {
        parentSpanId: span.parentSpanId,
        langfusePrompt: langfuseData?.prompt,
      });
    }

    const langfuseParent = this.getLangfuseParent(traceData, span, 'handleSpanStarted');
    if (!langfuseParent) {
      return;
    }

    const payload = this.buildSpanPayload(span, true, traceData);

    const langfuseSpan =
      span.type === SpanType.MODEL_GENERATION ? langfuseParent.generation(payload) : langfuseParent.span(payload);

    traceData.spans.set(span.id, langfuseSpan);

    // Flush immediately in realtime mode
    if (this.realtime) {
      await this.client.flushAsync();
    }
  }

  protected async handleSpanUpdated(span: AnyExportedSpan, traceData: LangfuseTraceData): Promise<void> {
    const langfuseSpan = traceData.spans.get(span.id);
    if (!langfuseSpan) {
      this.logger.warn('Langfuse exporter: No Langfuse span found for span update', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        spanType: span.type,
      });
      return;
    }

    langfuseSpan.update(this.buildSpanPayload(span, false, traceData));

    // Flush immediately in realtime mode
    if (this.realtime) {
      await this.client.flushAsync();
    }
  }

  protected async handleSpanEnded(span: AnyExportedSpan, traceData: LangfuseTraceData): Promise<void> {
    const langfuseSpan = traceData.spans.get(span.id);
    if (!langfuseSpan) {
      // For event spans that only send SPAN_ENDED, we might not have the span yet
      if (span.isEvent) {
        return;
      }

      this.logger.warn('Langfuse exporter: No Langfuse span found for span end', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        spanType: span.type,
      });
      return;
    }

    // Use update for end so we can use the end time we set
    langfuseSpan.update(this.buildSpanPayload(span, false, traceData));

    if (span.isRootSpan) {
      traceData.trace.update({ output: span.output });
    }

    // Flush immediately in realtime mode
    if (this.realtime) {
      await this.client.flushAsync();
    }
  }

  protected async handleEventSpan(span: AnyExportedSpan, traceData: LangfuseTraceData): Promise<void> {
    const langfuseParent = this.getLangfuseParent(traceData, span, 'handleEventSpan');
    if (!langfuseParent) {
      return;
    }

    const payload = this.buildSpanPayload(span, true, traceData);
    const langfuseEvent = langfuseParent.event(payload);
    traceData.events.set(span.id, langfuseEvent);

    // Flush immediately in realtime mode
    if (this.realtime) {
      await this.client.flushAsync();
    }
  }

  protected cleanupTraceData(_traceData: LangfuseTraceData, _traceId: string): void {
    // Langfuse handles cleanup through flushAsync, nothing specific needed here
  }

  // ==================== Helper Methods ====================

  private getLangfuseParent(
    traceData: LangfuseTraceData,
    span: AnyExportedSpan,
    method: string,
  ): LangfuseParent | undefined {
    const parentId = span.parentSpanId;
    if (!parentId) {
      return traceData.trace;
    }
    if (traceData.spans.has(parentId)) {
      return traceData.spans.get(parentId);
    }
    if (traceData.events.has(parentId)) {
      return traceData.events.get(parentId);
    }
    this.logger.warn('Langfuse exporter: No parent data found for span', {
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

  private buildTracePayload(span: AnyExportedSpan): Record<string, any> {
    const payload: Record<string, any> = {
      id: span.traceId,
      name: span.name,
    };

    const { userId, sessionId, ...remainingMetadata } = span.metadata ?? {};

    if (userId) payload.userId = userId;
    if (sessionId) payload.sessionId = sessionId;
    if (span.input) payload.input = span.input;
    // Include tags if present (only for root spans, which is always the case here)
    if (span.tags?.length) payload.tags = span.tags;

    payload.metadata = {
      spanType: span.type,
      ...span.attributes,
      ...remainingMetadata,
    };

    return payload;
  }

  /**
   * Look up the Langfuse prompt from the closest parent span that has one.
   * This enables prompt inheritance for MODEL_GENERATION spans when the prompt
   * is set on a parent span (e.g., AGENT_RUN) rather than directly on the generation.
   */
  private findParentLangfusePrompt(traceData: LangfuseTraceData, span: AnyExportedSpan): LangfusePromptData | undefined {
    let currentSpanId = span.parentSpanId;

    while (currentSpanId) {
      const parentMetadata = traceData.spanMetadata.get(currentSpanId);
      if (parentMetadata?.langfusePrompt) {
        return parentMetadata.langfusePrompt;
      }
      currentSpanId = parentMetadata?.parentSpanId;
    }

    return undefined;
  }

  private buildSpanPayload(span: AnyExportedSpan, isCreate: boolean, traceData: LangfuseTraceData): Record<string, any> {
    const payload: Record<string, any> = {};

    if (isCreate) {
      payload.id = span.id;
      payload.name = span.name;
      payload.startTime = span.startTime;
      if (span.input !== undefined) payload.input = span.input;
    }

    if (span.output !== undefined) payload.output = span.output;
    if (span.endTime !== undefined) payload.endTime = span.endTime;

    const attributes = (span.attributes ?? {}) as Record<string, any>;

    // For MODEL_GENERATION spans without langfuse metadata, look up the closest
    // parent span that has langfuse prompt data. This enables prompt linking when:
    // - A workflow calls multiple agents, each with different prompts
    // - Nested agents have different prompts
    // - The prompt is set on AGENT_RUN but MODEL_GENERATION inherits it
    let inheritedLangfusePrompt: LangfusePromptData | undefined;

    if (span.type === SpanType.MODEL_GENERATION && !span.metadata?.langfuse) {
      inheritedLangfusePrompt = this.findParentLangfusePrompt(traceData, span);
    }

    const metadata: Record<string, any> = {
      ...span.metadata,
      ...(inheritedLangfusePrompt ? { langfuse: { prompt: inheritedLangfusePrompt } } : {}),
    };

    // Strip special fields from metadata if used in top-level keys
    const attributesToOmit: string[] = [];
    const metadataToOmit: string[] = [];

    if (span.type === SpanType.MODEL_GENERATION) {
      const modelAttr = attributes as ModelGenerationAttributes;

      if (modelAttr.model !== undefined) {
        payload.model = modelAttr.model;
        attributesToOmit.push('model');
      }

      if (modelAttr.usage !== undefined) {
        payload.usageDetails = formatUsageMetrics(modelAttr.usage);
        attributesToOmit.push('usage');
      }

      if (modelAttr.parameters !== undefined) {
        payload.modelParameters = modelAttr.parameters;
        attributesToOmit.push('parameters');
      }

      // Handle Langfuse prompt linking
      // Users can set metadata.langfuse.prompt to link generations to Langfuse Prompt Management
      // Supported formats:
      // - { id } - link by prompt UUID alone
      // - { name, version } - link by name and version
      // - { name, version, id } - link with all fields
      const langfuseData = metadata.langfuse as
        | { prompt?: { name?: string; version?: number; id?: string } }
        | undefined;
      const promptData = langfuseData?.prompt;
      const hasNameAndVersion = promptData?.name !== undefined && promptData?.version !== undefined;
      const hasId = promptData?.id !== undefined;

      if (hasNameAndVersion || hasId) {
        payload.prompt = {};

        if (promptData?.name !== undefined) payload.prompt.name = promptData.name;
        if (promptData?.version !== undefined) payload.prompt.version = promptData.version;
        if (promptData?.id !== undefined) payload.prompt.id = promptData.id;

        metadataToOmit.push('langfuse');
      }

      // completionStartTime is used by Langfuse to calculate time-to-first-token (TTFT)
      if (modelAttr.completionStartTime !== undefined) {
        payload.completionStartTime = modelAttr.completionStartTime;
        attributesToOmit.push('completionStartTime');
      }
    }

    payload.metadata = {
      spanType: span.type,
      ...omitKeys(attributes, attributesToOmit),
      ...omitKeys(metadata, metadataToOmit),
    };

    if (span.errorInfo) {
      payload.level = 'ERROR';
      payload.statusMessage = span.errorInfo.message;
    }

    return payload;
  }

  async addScoreToTrace({
    traceId,
    spanId,
    score,
    reason,
    scorerName,
    metadata,
  }: {
    traceId: string;
    spanId?: string;
    score: number;
    reason?: string;
    scorerName: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.score({
        id: `${traceId}-${scorerName}`,
        traceId,
        observationId: spanId,
        name: scorerName,
        value: score,
        ...(metadata?.sessionId ? { sessionId: metadata.sessionId } : {}),
        metadata: { ...(reason ? { reason } : {}) },
        dataType: 'NUMERIC',
      });
    } catch (error) {
      this.logger.error('Langfuse exporter: Error adding score to trace', {
        error,
        traceId,
        spanId,
        scorerName,
      });
    }
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.shutdownAsync();
    }
    await super.shutdown();
  }
}
