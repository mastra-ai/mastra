/**
 * Langfuse Exporter for Mastra Observability
 *
 * This exporter sends observability data to Langfuse.
 * Root spans start traces in Langfuse.
 * MODEL_GENERATION spans become Langfuse generations, all others become spans.
 */

import type { TracingEvent, AnyExportedSpan, ModelGenerationAttributes, UsageStats } from '@mastra/core/observability';
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

type LangfusePromptData = { name?: string; version?: number; id?: string };

type SpanMetadata = {
  parentSpanId?: string;
  langfusePrompt?: LangfusePromptData;
};

type TraceData = {
  trace: LangfuseTraceClient; // Langfuse trace object
  spans: Map<string, LangfuseSpanClient | LangfuseGenerationClient>; // Maps span.id to Langfuse span/generation
  spanMetadata: Map<string, SpanMetadata>; // Maps span.id to span metadata for prompt inheritance
  events: Map<string, LangfuseEventClient>; // Maps span.id to Langfuse event
  activeSpans: Set<string>; // Tracks which spans haven't ended yet
  rootSpanId?: string; // Track the root span ID
  isLazy?: boolean; // True if trace was created lazily from a child span before root span arrived
};

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

    // Handle out-of-order span arrival (GitHub #11060):
    // Check if trace exists first WITHOUT logging a warning
    let traceData = this.traceMap.get(span.traceId);

    // If a child span arrives before the root span (due to async event processing),
    // create a lazy trace to store the child span. The root span will update this
    // trace when it arrives later.
    if (!traceData && !span.isRootSpan) {
      this.logger.debug('Langfuse exporter: Creating lazy trace for out-of-order child span', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        spanType: span.type,
        parentSpanId: span.parentSpanId,
      });
      this.initLazyTrace(span);
      traceData = this.traceMap.get(span.traceId);
    }

    if (!traceData) {
      // Only log warning for root spans that failed to create trace (unexpected)
      this.logger.warn('Langfuse exporter: No trace data found for span', {
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

    // Store span metadata for prompt inheritance lookup (for non-root spans)
    if (!span.isRootSpan) {
      const langfuseData = span.metadata?.langfuse as { prompt?: LangfusePromptData } | undefined;
      traceData.spanMetadata.set(span.id, {
        parentSpanId: span.parentSpanId,
        langfusePrompt: langfuseData?.prompt,
      });
    }

    // For lazy traces, parent spans may not exist yet. Use trace as parent.
    const langfuseParent = this.getLangfuseParent({ traceData, span, method, allowMissingParent: traceData.isLazy });
    if (!langfuseParent) {
      return;
    }

    const payload = this.buildSpanPayload(span, true, traceData);

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
    langfuseSpan.update(this.buildSpanPayload(span, false, traceData));

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

    // Handle out-of-order event span arrival (similar to handleSpanStarted)
    // Check if trace exists first WITHOUT logging a warning
    let traceData = this.traceMap.get(span.traceId);

    if (!traceData && !span.isRootSpan) {
      this.logger.debug('Langfuse exporter: Creating lazy trace for out-of-order child event span', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        spanType: span.type,
        parentSpanId: span.parentSpanId,
      });
      this.initLazyTrace(span);
      traceData = this.traceMap.get(span.traceId);
    }

    if (!traceData) {
      // Only log warning for root spans that failed to create trace (unexpected)
      this.logger.warn('Langfuse exporter: No trace data found for span', {
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

    // For lazy traces, parent spans may not exist yet. Use trace as parent.
    const langfuseParent = this.getLangfuseParent({ traceData, span, method, allowMissingParent: traceData.isLazy });
    if (!langfuseParent) {
      return;
    }

    const payload = this.buildSpanPayload(span, true, traceData);

    const langfuseEvent = langfuseParent.event(payload);

    traceData.events.set(span.id, langfuseEvent);

    // Event spans are typically immediately ended, but let's track them properly
    if (!span.endTime) {
      traceData.activeSpans.add(span.id);
    }
  }

  private initTrace(span: AnyExportedSpan): void {
    // Check if trace already exists in our local traceMap
    // This can happen in two scenarios:
    // 1. Multiple root spans share the same traceId (e.g., multiple agent.stream calls)
    // 2. Child spans arrived before the root span (lazy trace creation for out-of-order events)
    const existingTraceData = this.traceMap.get(span.traceId);
    if (existingTraceData) {
      // Check if this is a lazy trace that needs to be upgraded with root span metadata
      if (existingTraceData.isLazy) {
        this.logger.debug('Langfuse exporter: Upgrading lazy trace with root span metadata', {
          traceId: span.traceId,
          spanId: span.id,
          spanName: span.name,
        });
        // Update the trace with the root span's full metadata
        existingTraceData.trace.update(this.buildTracePayload(span));
        existingTraceData.rootSpanId = span.id;
        existingTraceData.isLazy = false;

        // Store root span metadata for prompt inheritance
        const langfuseData = span.metadata?.langfuse as { prompt?: LangfusePromptData } | undefined;
        existingTraceData.spanMetadata.set(span.id, {
          parentSpanId: undefined,
          langfusePrompt: langfuseData?.prompt,
        });
        return;
      }

      this.logger.debug('Langfuse exporter: Reusing existing trace from local map', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
      });
      return; // Reuse existing trace
    }

    // Note: If the traceId already exists in Langfuse (e.g., from a previous server instance
    // or session), the Langfuse SDK handles this gracefully. Calling client.trace() with
    // an existing ID is idempotent - it will update/continue the existing trace rather than
    // failing or creating a duplicate. This is by design for distributed tracing scenarios.
    // See: https://langfuse.com/docs/tracing-features/trace-ids
    const trace = this.client.trace(this.buildTracePayload(span));

    // Extract langfuse prompt data from root span
    const langfuseData = span.metadata?.langfuse as { prompt?: LangfusePromptData } | undefined;
    const spanMetadata = new Map<string, SpanMetadata>();

    // Store root span metadata for prompt inheritance
    spanMetadata.set(span.id, {
      parentSpanId: undefined,
      langfusePrompt: langfuseData?.prompt,
    });

    this.traceMap.set(span.traceId, {
      trace,
      spans: new Map(),
      spanMetadata,
      events: new Map(),
      activeSpans: new Set(),
      rootSpanId: span.id,
      isLazy: false,
    });
  }

  /**
   * Create a lazy trace for a child span that arrived before its root span.
   * This handles the race condition where async event processing causes
   * child spans to be processed before their parent root spans (GitHub #11060).
   *
   * The lazy trace will be upgraded with full metadata when the root span arrives.
   */
  private initLazyTrace(span: AnyExportedSpan): void {
    // Create a minimal trace with just the traceId
    // The Langfuse SDK allows creating traces with just an ID, and updating them later
    const trace = this.client.trace({
      id: span.traceId,
      name: `(pending root span)`, // Placeholder name until root span arrives
    });

    this.traceMap.set(span.traceId, {
      trace,
      spans: new Map(),
      spanMetadata: new Map(),
      events: new Map(),
      activeSpans: new Set(),
      rootSpanId: undefined, // Will be set when root span arrives
      isLazy: true, // Mark as lazy trace
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
    allowMissingParent?: boolean;
  }): LangfuseParent | undefined {
    const { traceData, span, method, allowMissingParent } = options;

    const parentId = span.parentSpanId;
    if (!parentId) {
      return traceData.trace;
    }
    if (traceData.spans.has(parentId)) {
      return traceData.spans.get(parentId);
    }
    // For lazy traces (out-of-order span arrival), the parent span may not exist yet.
    // In this case, attach the child span directly to the trace. The parent relationship
    // will be established visually in Langfuse based on the parentSpanId in metadata.
    if (allowMissingParent) {
      this.logger.debug('Langfuse exporter: Parent span not found, using trace as parent (lazy trace)', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        parentSpanId: parentId,
      });
      return traceData.trace;
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
  private findParentLangfusePrompt(traceData: TraceData, span: AnyExportedSpan): LangfusePromptData | undefined {
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

  private buildSpanPayload(span: AnyExportedSpan, isCreate: boolean, traceData?: TraceData): Record<string, any> {
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
    const resolvedTraceData = traceData ?? this.traceMap.get(span.traceId);
    let inheritedLangfusePrompt: LangfusePromptData | undefined;

    if (span.type === SpanType.MODEL_GENERATION && !span.metadata?.langfuse && resolvedTraceData) {
      inheritedLangfusePrompt = this.findParentLangfusePrompt(resolvedTraceData, span);
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
    this.traceMap.clear();
    await super.shutdown();
  }
}
