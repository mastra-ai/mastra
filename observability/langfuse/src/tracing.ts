/**
 * Langfuse Exporter for Mastra Observability
 *
 * This exporter sends observability data to Langfuse.
 * Root spans start traces in Langfuse.
 * MODEL_GENERATION spans become Langfuse generations, all others become spans.
 */

import type { AnyExportedSpan, ModelGenerationAttributes, SpanErrorInfo } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import { TrackingExporter } from '@mastra/observability';
import type { TrackingExporterConfig, TraceData } from '@mastra/observability';
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
  #client: Langfuse | undefined;
  #realtime: boolean;

  constructor(config: LangfuseExporterConfig = {}) {
    // Resolve env vars BEFORE calling super (config is readonly in base class)
    const publicKey = config.publicKey ?? process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = config.secretKey ?? process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = config.baseUrl ?? process.env.LANGFUSE_BASE_URL;

    super({
      ...config,
      publicKey,
      secretKey,
      baseUrl,
    });

    this.#realtime = config.realtime ?? false;

    if (!publicKey || !secretKey) {
      const publicKeySource = config.publicKey
        ? 'from config'
        : process.env.LANGFUSE_PUBLIC_KEY
          ? 'from env'
          : 'missing';
      const secretKeySource = config.secretKey
        ? 'from config'
        : process.env.LANGFUSE_SECRET_KEY
          ? 'from env'
          : 'missing';
      this.setDisabled(
        `Missing required credentials (publicKey: ${publicKeySource}, secretKey: ${secretKeySource}). ` +
          `Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY environment variables or pass them in config.`,
      );
      return;
    }

    this.#client = new Langfuse({
      publicKey,
      secretKey,
      baseUrl,
      ...config.options,
    });
  }

  protected override async _postExportTracingEvent(): Promise<void> {
    // Flush immediately in realtime mode for instant visibility
    if (this.#realtime) {
      await this.#client?.flushAsync();
    }
  }

  protected override async _buildRoot(args: {
    span: AnyExportedSpan;
    traceData: LangfuseTraceData;
  }): Promise<LangfuseTraceClient | undefined> {
    const { span } = args;
    // Note: If the traceId already exists in Langfuse (e.g., from a previous server instance
    // or session), the Langfuse SDK handles this gracefully. Calling client.trace() with
    // an existing ID is idempotent - it will update/continue the existing trace rather than
    // failing or creating a duplicate. This is by design for distributed tracing scenarios.
    // See: https://langfuse.com/docs/tracing-features/trace-ids
    return this.#client?.trace(this.buildTracePayload(span));
  }

  protected override async _buildEvent(args: {
    span: AnyExportedSpan;
    traceData: LangfuseTraceData;
  }): Promise<LangfuseEvent | undefined> {
    const { span, traceData } = args;
    const langfuseParent = traceData.getParentOrRoot({ span });
    if (!langfuseParent) {
      return;
    }

    const payload = this.buildSpanPayload(span, true, traceData);
    return langfuseParent.event(payload);
  }

  protected override async _buildSpan(args: {
    span: AnyExportedSpan;
    traceData: LangfuseTraceData;
  }): Promise<LangfuseSpan | undefined> {
    const { span, traceData } = args;
    const langfuseParent = traceData.getParentOrRoot({ span });
    if (!langfuseParent) {
      return;
    }

    const payload = this.buildSpanPayload(span, true, traceData);

    const langfuseSpan =
      span.type === SpanType.MODEL_GENERATION ? langfuseParent.generation(payload) : langfuseParent.span(payload);

    this.logger.debug(`${this.name}: built span`, {
      traceId: span.traceId,
      spanId: payload.id,
      method: '_buildSpan',
    });

    return langfuseSpan;
  }

  protected override async _updateSpan(args: { span: AnyExportedSpan; traceData: LangfuseTraceData }): Promise<void> {
    const { span, traceData } = args;
    const langfuseSpan = traceData.getSpan({ spanId: span.id });
    if (langfuseSpan) {
      this.logger.debug(`${this.name}: found span for update`, {
        traceId: span.traceId,
        spanId: langfuseSpan.id,
        method: '_updateSpan',
      });

      const updatePayload = this.buildSpanPayload(span, false, traceData);

      // use update for both update & end, so that we can use the
      // end time we set when ending the span.
      langfuseSpan.update(updatePayload);
    }
  }

  protected override async _finishSpan(args: { span: AnyExportedSpan; traceData: LangfuseTraceData }): Promise<void> {
    const { span, traceData } = args;
    const langfuseSpan = traceData.getSpan({ spanId: span.id });
    // use update for both update & end, so that we can use the
    // end time we set when ending the span.
    langfuseSpan?.update(this.buildSpanPayload(span, false, traceData));

    if (span.isRootSpan) {
      const langfuseRoot = traceData.getRoot();
      langfuseRoot?.update({ output: span.output });
    }
  }

  protected override async _abortSpan(args: { span: LangfuseSpan; reason: SpanErrorInfo }): Promise<void> {
    const { span, reason } = args;
    span.end({
      level: 'ERROR',
      statusMessage: reason.message,
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
   * Look up the Langfuse prompt from the closest span that has one.
   * This enables prompt inheritance for MODEL_GENERATION spans when the prompt
   * is set on a parent span (e.g., AGENT_RUN) rather than directly on the generation.
   * This enables prompt linking when:
   * - A workflow calls multiple agents, each with different prompts
   * - Nested agents have different prompts
   * - The prompt is set on AGENT_RUN but MODEL_GENERATION inherits it
   */
  private findLangfusePrompt(traceData: LangfuseTraceData, span: AnyExportedSpan): LangfusePromptData | undefined {
    let currentSpanId: string | undefined = span.id;

    while (currentSpanId) {
      const providerMetadata = traceData.getMetadata({ spanId: currentSpanId });

      if (providerMetadata?.prompt) {
        this.logger.debug(`${this.name}: found prompt in provider metadata`, {
          traceId: span.traceId,
          spanId: span.id,
          prompt: providerMetadata?.prompt,
        });
        return providerMetadata.prompt;
      }
      currentSpanId = traceData.getParentId({ spanId: currentSpanId });
    }

    return undefined;
  }

  private buildSpanPayload(
    span: AnyExportedSpan,
    isCreate: boolean,
    traceData: LangfuseTraceData,
  ): Record<string, any> {
    const payload: Record<string, any> = {};

    if (isCreate) {
      payload.id = span.id;
      payload.name = span.name;
      payload.startTime = span.startTime;
    }

    if (span.input !== undefined) payload.input = span.input;
    if (span.output !== undefined) payload.output = span.output;
    if (span.endTime !== undefined) payload.endTime = span.endTime;

    const attributes = (span.attributes ?? {}) as Record<string, any>;

    const metadata: Record<string, any> = {
      ...span.metadata,
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

      // Users can set metadata.langfuse.prompt to link generations to Langfuse Prompt Management
      // Supported formats:
      // - { id } - link by prompt UUID alone
      // - { name, version } - link by name and version
      // - { name, version, id } - link with all fields
      const promptData = this.findLangfusePrompt(traceData, span);
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
    if (!this.#client) return;

    try {
      await this.#client.score({
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

  /**
   * Force flush any buffered data to Langfuse without shutting down.
   */
  protected override async _flush(): Promise<void> {
    if (this.#client) {
      await this.#client.flushAsync();
    }
  }

  override async _postShutdown(): Promise<void> {
    if (this.#client) {
      await this.#client.shutdownAsync();
    }
  }
}
