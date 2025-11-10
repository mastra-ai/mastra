/**
 * Langfuse Exporter for Mastra Observability
 *
 * This exporter sends observability data to Langfuse.
 * Root spans start traces in Langfuse.
 * MODEL_GENERATION spans become Langfuse generations, all others become spans.
 *
 * Compatible with both AI SDK v4 and v5:
 * - Handles both legacy token usage format (promptTokens/completionTokens)
 *   and v5 format (inputTokens/outputTokens)
 * - Supports v5 reasoning tokens and cache-related metrics
 * - Adapts to v5 streaming protocol changes
 */

import type { TracingEvent, AnyExportedSpan, ModelGenerationAttributes } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import { BaseExporter } from '@mastra/observability';
import type { BaseExporterConfig } from '@mastra/observability';
import { Langfuse } from 'langfuse';
import type { LangfuseTraceClient, LangfuseSpanClient, LangfuseGenerationClient, LangfuseEventClient } from 'langfuse';

export interface LangfuseExporterConfig extends BaseExporterConfig {
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

type TraceData = {
  trace: LangfuseTraceClient; // Langfuse trace object
  spans: Map<string, LangfuseSpanClient | LangfuseGenerationClient>; // Maps span.id to Langfuse span/generation
  events: Map<string, LangfuseEventClient>; // Maps span.id to Langfuse event
  activeSpans: Set<string>; // Tracks which spans haven't ended yet
  rootSpanId?: string; // Track the root span ID
};

type LangfuseParent = LangfuseTraceClient | LangfuseSpanClient | LangfuseGenerationClient | LangfuseEventClient;

/**
 * Normalized token usage format compatible with Langfuse.
 * This unified format supports both AI SDK v4 and v5 token structures.
 *
 * @example
 * ```typescript
 * // AI SDK v4 format normalizes to:
 * { input: 100, output: 50, total: 150 }
 *
 * // AI SDK v5 format normalizes to:
 * { input: 120, output: 60, total: 180, reasoning: 1000, cachedInput: 50 }
 * ```
 */
interface NormalizedUsage {
  /**
   * Input tokens sent to the model
   * @source AI SDK v5: `inputTokens` | AI SDK v4: `promptTokens`
   */
  input?: number;

  /**
   * Output tokens received from the model
   * @source AI SDK v5: `outputTokens` | AI SDK v4: `completionTokens`
   */
  output?: number;

  /**
   * Total tokens (input + output + reasoning if applicable)
   * @source AI SDK v4 & v5: `totalTokens`
   */
  total?: number;

  /**
   * Reasoning tokens used by reasoning models
   * @source AI SDK v5: `reasoningTokens`
   * @since AI SDK v5.0.0
   * @example Models like o1-preview, o1-mini
   */
  reasoning?: number;

  /**
   * Cached input tokens (prompt cache hit)
   * @source AI SDK v5: `cachedInputTokens`
   * @since AI SDK v5.0.0
   * @example Anthropic's prompt caching, OpenAI prompt caching
   */
  cachedInput?: number;

  /**
   * Prompt cache hit tokens (legacy format)
   * @source AI SDK v4: `promptCacheHitTokens`
   * @deprecated Prefer `cachedInput` from v5 format
   */
  promptCacheHit?: number;

  /**
   * Prompt cache miss tokens (legacy format)
   * @source AI SDK v4: `promptCacheMissTokens`
   * @deprecated Prefer v5 format which uses `cachedInputTokens`
   */
  promptCacheMiss?: number;
}

export class LangfuseExporter extends BaseExporter {
  name = 'langfuse';
  private client: Langfuse;
  private realtime: boolean;
  private traceMap = new Map<string, TraceData>();

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

    // Flush immediately in realtime mode for instant visibility
    if (this.realtime) {
      await this.client.flushAsync();
    }
  }

  private async handleSpanStarted(span: AnyExportedSpan): Promise<void> {
    if (span.isRootSpan) {
      this.initTrace(span);
    }
    const method = 'handleSpanStarted';

    const traceData = this.getTraceData({ span, method });
    if (!traceData) {
      return;
    }

    const langfuseParent = this.getLangfuseParent({ traceData, span, method });
    if (!langfuseParent) {
      return;
    }

    const payload = this.buildSpanPayload(span, true);

    const langfuseSpan =
      span.type === SpanType.MODEL_GENERATION ? langfuseParent.generation(payload) : langfuseParent.span(payload);

    traceData.spans.set(span.id, langfuseSpan);
    traceData.activeSpans.add(span.id); // Track as active
  }

  private async handleSpanUpdateOrEnd(span: AnyExportedSpan, isEnd: boolean): Promise<void> {
    const method = isEnd ? 'handleSpanEnd' : 'handleSpanUpdate';

    const traceData = this.getTraceData({ span, method });
    if (!traceData) {
      return;
    }

    const langfuseSpan = traceData.spans.get(span.id);
    if (!langfuseSpan) {
      // For event spans that only send SPAN_ENDED, we might not have the span yet
      if (isEnd && span.isEvent) {
        // Just make sure it's not in active spans
        traceData.activeSpans.delete(span.id);
        if (traceData.activeSpans.size === 0) {
          this.traceMap.delete(span.traceId);
        }
        return;
      }

      this.logger.warn('Langfuse exporter: No Langfuse span found for span update/end', {
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

    // use update for both update & end, so that we can use the
    // end time we set when ending the span.
    langfuseSpan.update(this.buildSpanPayload(span, false));

    if (isEnd) {
      // Remove from active spans
      traceData.activeSpans.delete(span.id);

      if (span.isRootSpan) {
        traceData.trace.update({ output: span.output });
      }

      // Only clean up the trace when ALL spans have ended
      if (traceData.activeSpans.size === 0) {
        this.traceMap.delete(span.traceId);
      }
    }
  }

  private async handleEventSpan(span: AnyExportedSpan): Promise<void> {
    if (span.isRootSpan) {
      this.logger.debug('Langfuse exporter: Creating trace', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        method: 'handleEventSpan',
      });
      this.initTrace(span);
    }
    const method = 'handleEventSpan';

    const traceData = this.getTraceData({ span, method });
    if (!traceData) {
      return;
    }

    const langfuseParent = this.getLangfuseParent({ traceData, span, method });
    if (!langfuseParent) {
      return;
    }

    const payload = this.buildSpanPayload(span, true);

    const langfuseEvent = langfuseParent.event(payload);

    traceData.events.set(span.id, langfuseEvent);

    // Event spans are typically immediately ended, but let's track them properly
    if (!span.endTime) {
      traceData.activeSpans.add(span.id);
    }
  }

  private initTrace(span: AnyExportedSpan): void {
    const trace = this.client.trace(this.buildTracePayload(span));
    this.traceMap.set(span.traceId, {
      trace,
      spans: new Map(),
      events: new Map(),
      activeSpans: new Set(),
      rootSpanId: span.id,
    });
  }

  private getTraceData(options: { span: AnyExportedSpan; method: string }): TraceData | undefined {
    const { span, method } = options;

    if (this.traceMap.has(span.traceId)) {
      return this.traceMap.get(span.traceId);
    }

    this.logger.warn('Langfuse exporter: No trace data found for span', {
      traceId: span.traceId,
      spanId: span.id,
      spanName: span.name,
      spanType: span.type,
      isRootSpan: span.isRootSpan,
      parentSpanId: span.parentSpanId,
      method,
    });
  }

  private getLangfuseParent(options: {
    traceData: TraceData;
    span: AnyExportedSpan;
    method: string;
  }): LangfuseParent | undefined {
    const { traceData, span, method } = options;

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

    payload.metadata = {
      spanType: span.type,
      ...span.attributes,
      ...remainingMetadata,
    };

    return payload;
  }

  /**
   * Normalize usage data to handle both AI SDK v4 and v5 formats.
   *
   * AI SDK v4 uses: promptTokens, completionTokens
   * AI SDK v5 uses: inputTokens, outputTokens
   *
   * This function normalizes to a unified format that Langfuse can consume,
   * prioritizing v5 format while maintaining backward compatibility.
   *
   * @param usage - Token usage data from AI SDK (v4 or v5 format)
   * @returns Normalized usage object, or undefined if no usage data available
   */
  private normalizeUsage(usage: ModelGenerationAttributes['usage']): NormalizedUsage | undefined {
    if (!usage) return undefined;

    const normalized: NormalizedUsage = {};

    // Handle input tokens (v5 'inputTokens' or v4 'promptTokens')
    // Using ?? to prioritize v5 format while falling back to v4
    const inputTokens = usage.inputTokens ?? usage.promptTokens;
    if (inputTokens !== undefined) {
      normalized.input = inputTokens;
    }

    // Handle output tokens (v5 'outputTokens' or v4 'completionTokens')
    const outputTokens = usage.outputTokens ?? usage.completionTokens;
    if (outputTokens !== undefined) {
      normalized.output = outputTokens;
    }

    // Total tokens - calculate if not provided
    if (usage.totalTokens !== undefined) {
      normalized.total = usage.totalTokens;
    } else if (normalized.input !== undefined && normalized.output !== undefined) {
      normalized.total = normalized.input + normalized.output;
    }

    // AI SDK v5-specific: reasoning tokens
    if (usage.reasoningTokens !== undefined) {
      normalized.reasoning = usage.reasoningTokens;
    }

    // AI SDK v5-specific: cached tokens (cache hit)
    if (usage.cachedInputTokens !== undefined) {
      normalized.cachedInput = usage.cachedInputTokens;
    }

    // Legacy cache metrics (promptCacheHitTokens/promptCacheMissTokens)
    if (usage.promptCacheHitTokens !== undefined) {
      normalized.promptCacheHit = usage.promptCacheHitTokens;
    }
    if (usage.promptCacheMissTokens !== undefined) {
      normalized.promptCacheMiss = usage.promptCacheMissTokens;
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  private buildSpanPayload(span: AnyExportedSpan, isCreate: boolean): Record<string, any> {
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

    // Strip special fields from metadata if used in top-level keys
    const attributesToOmit: string[] = [];

    if (span.type === SpanType.MODEL_GENERATION) {
      const modelAttr = attributes as ModelGenerationAttributes;

      if (modelAttr.model !== undefined) {
        payload.model = modelAttr.model;
        attributesToOmit.push('model');
      }

      if (modelAttr.usage !== undefined) {
        // Normalize usage to handle both v4 and v5 formats
        const normalizedUsage = this.normalizeUsage(modelAttr.usage);
        if (normalizedUsage) {
          payload.usage = normalizedUsage;
        }
        attributesToOmit.push('usage');
      }

      if (modelAttr.parameters !== undefined) {
        payload.modelParameters = modelAttr.parameters;
        attributesToOmit.push('parameters');
      }
    }

    payload.metadata = {
      spanType: span.type,
      ...omitKeys(attributes, attributesToOmit),
      ...span.metadata,
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
    this.traceMap.clear();
    await super.shutdown();
  }
}
