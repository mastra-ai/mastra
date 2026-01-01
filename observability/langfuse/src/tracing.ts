/**
 * Langfuse Exporter for Mastra Observability
 *
 * This exporter sends observability data to Langfuse.
 * Root spans start traces in Langfuse.
 * MODEL_GENERATION spans become Langfuse generations, all others become spans.
 */

import type { AnyExportedSpan, ModelGenerationAttributes } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import { TrackingExporter } from '@mastra/observability';
import type { TrackingExporterConfig } from '@mastra/observability';
import  { TraceData } from '@mastra/observability';
import { Langfuse } from 'langfuse';
import type { LangfuseTraceClient, LangfuseSpanClient, LangfuseGenerationClient, LangfuseEventClient } from 'langfuse';
import { formatUsageMetrics } from './metrics';

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

/**
 * With Langfuse, data from the root span is stored in both the Root and the
 * first span.
 */

type LangfuseRoot = LangfuseTraceClient;
type LangfuseSpan = LangfuseSpanClient | LangfuseGenerationClient;
type LangfuseEvent = LangfuseEventClient;
type LangfuseMetadata = { prompt?: LangfusePromptData };
type LangfuseTraceData = TraceData<LangfuseRoot, LangfuseSpan, LangfuseEvent, LangfuseMetadata>;

export class LangfuseExporter extends TrackingExporter<
  LangfuseRoot,
  LangfuseSpan,
  LangfuseEvent,
  LangfuseMetadata,
  LangfuseExporterConfig
> {
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

  protected async _postExportTracingEvent(): Promise<void> {
    // Flush immediately in realtime mode for instant visibility
    if (this.realtime) {
      await this.client.flushAsync();
    }
  }

  protected async _buildRoot(args: { span: AnyExportedSpan; traceData: LangfuseTraceData; }): Promise<LangfuseTraceClient | undefined> {
    const { span } = args;
    // Note: If the traceId already exists in Langfuse (e.g., from a previous server instance
    // or session), the Langfuse SDK handles this gracefully. Calling client.trace() with
    // an existing ID is idempotent - it will update/continue the existing trace rather than
    // failing or creating a duplicate. This is by design for distributed tracing scenarios.
    // See: https://langfuse.com/docs/tracing-features/trace-ids
    return this.client.trace(this.buildTracePayload(span));
  }

  protected async _buildEvent(args: { span: AnyExportedSpan, traceData: LangfuseTraceData }): Promise<LangfuseEvent | undefined> {
    const { span, traceData } = args;
    const langfuseParent = traceData.getParent({ span })
    if (!langfuseParent) {
      return;
    }

    const payload = this.buildSpanPayload(span, true, traceData);
    return langfuseParent.event(payload);
  }

  protected async _buildSpan(args: { span: AnyExportedSpan, traceData: LangfuseTraceData }): Promise<LangfuseSpan | undefined> {
    const { span, traceData } = args;
    const langfuseParent = traceData.getParent({ span })
    if (!langfuseParent) {
      return;
    }

    const payload = this.buildSpanPayload(span, true, traceData);

    const langfuseSpan =
      span.type === SpanType.MODEL_GENERATION ? langfuseParent.generation(payload) : langfuseParent.span(payload);

    this.logger.debug(`${this.name}: built span`, {
          traceId: span.traceId,
          spanId: langfuseSpan.id,
          method: "_buildSpan",
      });

    return langfuseSpan;
  }

  protected async _updateSpan(args: { span: AnyExportedSpan, traceData: LangfuseTraceData }): Promise<void> {
    const { span, traceData } = args;
    const langfuseSpan = traceData.getSpan({spanId: span.id})
    if (langfuseSpan) {
        this.logger.debug(`${this.name}: found span for update`, {
          traceId: span.traceId,
          spanId: langfuseSpan.id,
          method: "_updateSpan",
      });

      const updatePayload = this.buildSpanPayload(span, false, traceData);

      console.log(updatePayload)

      // use update for both update & end, so that we can use the
      // end time we set when ending the span.
      langfuseSpan.update(updatePayload);
    }
  }

  protected async _finishSpan(args: { span: AnyExportedSpan, traceData: LangfuseTraceData }): Promise<void> {
    const { span, traceData } = args;
    const langfuseSpan = traceData.getSpan({spanId: span.id})
    // use update for both update & end, so that we can use the
    // end time we set when ending the span.
    langfuseSpan?.update(this.buildSpanPayload(span, false, traceData));

    if (span.isRootSpan) {
      const langfuseRoot = traceData.getRoot();
      langfuseRoot?.update({ output: span.output });
    }
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
   * Look up the Langfuse prompt from the closest span that has one.
   * This enables prompt inheritance for MODEL_GENERATION spans when the prompt
   * is set on a parent span (e.g., AGENT_RUN) rather than directly on the generation.
   */
  private findLangfusePrompt(traceData: LangfuseTraceData, span: AnyExportedSpan): LangfusePromptData | undefined {
    let currentSpanId: string | undefined = span.id;

    while (currentSpanId) {
      const parentMetadata = traceData.getMetadata({spanId: currentSpanId});

      if (parentMetadata?.prompt) {
        return parentMetadata.prompt;
      }
      currentSpanId = traceData.getParentId({ spanId: currentSpanId });
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

    if (span.type === SpanType.MODEL_GENERATION) {
      inheritedLangfusePrompt = this.findLangfusePrompt(traceData, span);
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
    //TODO: This should be re-written to first stop accepting new spans,
    // then close all existing spans with some shutdown message
    // then waiting for the client to flush everything
    //
    // If the flush is extracted into some method outside shutdown,
    // it should optionally end any existing spans.
    this.clearTraceMap();
    await super.shutdown();
  }
}
