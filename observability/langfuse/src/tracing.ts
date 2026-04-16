/**
 * Langfuse Exporter for Mastra Observability
 *
 * Sends observability data to Langfuse using the official @langfuse/otel span processor
 * and @langfuse/client for non-tracing features (scoring, prompt management, evaluations).
 *
 * @see https://langfuse.com/docs/observability/sdk/typescript/overview
 */

import { LangfuseClient } from '@langfuse/client';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import type { TracingEvent, AnyExportedSpan, InitExporterOptions } from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';
import type { BaseExporterConfig } from '@mastra/observability';
import { SpanConverter } from '@mastra/otel-exporter';

const LOG_PREFIX = '[LangfuseExporter]';

export const LANGFUSE_DEFAULT_BASE_URL = 'https://cloud.langfuse.com';

export interface LangfuseExporterConfig extends BaseExporterConfig {
  /** Langfuse public key */
  publicKey?: string;
  /** Langfuse secret key */
  secretKey?: string;
  /** Langfuse host URL (defaults to https://cloud.langfuse.com) */
  baseUrl?: string;
  /** Enable realtime mode - flushes after each event for immediate visibility */
  realtime?: boolean;
  /** Langfuse environment tag for traces */
  environment?: string;
  /** Langfuse release tag for traces */
  release?: string;
}

export class LangfuseExporter extends BaseExporter {
  name = 'langfuse';
  #processor: LangfuseSpanProcessor | undefined;
  #client: LangfuseClient | undefined;
  #spanConverter: SpanConverter | undefined;
  #realtime: boolean;
  #environment: string | undefined;
  #release: string | undefined;

  constructor(config: LangfuseExporterConfig = {}) {
    super(config);

    const publicKey = config.publicKey ?? process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = config.secretKey ?? process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = (config.baseUrl ?? process.env.LANGFUSE_BASE_URL ?? LANGFUSE_DEFAULT_BASE_URL).replace(/\/+$/, '');
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
        `${LOG_PREFIX} Missing required credentials (publicKey: ${publicKeySource}, secretKey: ${secretKeySource}). ` +
          `Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY environment variables or pass them in config.`,
      );
      return;
    }

    this.#processor = new LangfuseSpanProcessor({
      publicKey,
      secretKey,
      baseUrl,
      environment: config.environment,
      release: config.release,
      exportMode: this.#realtime ? 'immediate' : 'batched',
      // Export all spans — the default filter only passes spans with gen_ai.* attributes
      // or known LLM instrumentation scopes, but Mastra spans use mastra.* attributes.
      shouldExportSpan: () => true,
    });

    this.#client = new LangfuseClient({
      publicKey,
      secretKey,
      baseUrl,
    });

    this.#environment = config.environment ?? process.env.LANGFUSE_TRACING_ENVIRONMENT;
    this.#release = config.release ?? process.env.LANGFUSE_RELEASE;
  }

  init(options: InitExporterOptions) {
    this.#spanConverter = new SpanConverter({
      packageName: '@mastra/langfuse',
      serviceName: options.config?.serviceName,
      format: 'GenAI_v1_38_0',
    });
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (event.type !== TracingEventType.SPAN_ENDED) return;
    if (!this.#processor) return;

    await this.exportSpan(event.exportedSpan);
  }

  private async exportSpan(span: AnyExportedSpan): Promise<void> {
    if (!this.#spanConverter) {
      // Fallback if init() was not called (e.g., standalone usage without Mastra)
      this.#spanConverter = new SpanConverter({
        packageName: '@mastra/langfuse',
        serviceName: 'mastra-service',
        format: 'GenAI_v1_38_0',
      });
    }

    try {
      const otelSpan = await this.#spanConverter.convertSpan(span);

      // Map mastra.* attributes to langfuse.* namespace so that Langfuse's OTLP
      // endpoint reads them correctly. SpanConverter produces mastra.* attributes,
      // but Langfuse only reads langfuse.* attributes for prompt linking, TTFT, etc.
      // @see https://langfuse.com/integrations/native/opentelemetry#property-mapping
      mapMastraToLangfuseAttributes(otelSpan.attributes, this.#environment, this.#release);

      this.#processor!.onEnd(otelSpan);
    } catch (error) {
      this.logger.error(`${LOG_PREFIX} Failed to export span ${span.id}:`, error);
    }
  }

  /**
   * The LangfuseClient instance for advanced Langfuse features.
   * Use this for prompt management, evaluations, datasets, and direct API access.
   */
  get client(): LangfuseClient | undefined {
    return this.#client;
  }

  /**
   * Add a score to a trace via the Langfuse client.
   */
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
      this.#client.score.create({
        id: `${traceId}-${spanId || ''}-${scorerName}`,
        traceId,
        ...(spanId ? { observationId: spanId } : {}),
        name: scorerName,
        value: score,
        ...(reason ? { comment: reason } : {}),
        ...(metadata ? { metadata } : {}),
        dataType: 'NUMERIC' as const,
      });
    } catch (error) {
      this.logger.error(`${LOG_PREFIX} Error adding score to trace`, {
        error,
        traceId,
        spanId,
        scorerName,
      });
    }
  }

  async flush(): Promise<void> {
    await Promise.all([this.#processor?.forceFlush(), this.#client?.flush()]);
  }

  async shutdown(): Promise<void> {
    await Promise.all([this.#processor?.shutdown(), this.#client?.shutdown()]);
  }
}

/**
 * Maps Mastra-specific OTel attributes to the langfuse.* namespace that
 * Langfuse's OTLP endpoint reads for prompt linking, TTFT, and other features.
 *
 * SpanConverter produces attributes like mastra.metadata.*, mastra.completion_start_time, etc.
 * Langfuse's OTLP server only reads langfuse.observation.prompt.name, langfuse.observation.completion_start_time, etc.
 *
 * This function mutates the attributes object in place.
 * @see https://langfuse.com/integrations/native/opentelemetry#property-mapping
 */
function mapMastraToLangfuseAttributes(attributes: Record<string, any>, environment?: string, release?: string): void {
  // Environment and release: set directly since onStart() is not called
  if (environment) {
    attributes['langfuse.environment'] = environment;
  }
  if (release) {
    attributes['langfuse.release'] = release;
  }

  // Prompt linking: mastra.metadata.langfuse → langfuse.observation.prompt.name / version
  const langfuseMetadata = attributes['mastra.metadata.langfuse'];
  if (langfuseMetadata) {
    try {
      const parsed = typeof langfuseMetadata === 'string' ? JSON.parse(langfuseMetadata) : langfuseMetadata;
      if (parsed?.prompt) {
        if (parsed.prompt.name !== undefined) {
          attributes['langfuse.observation.prompt.name'] = parsed.prompt.name;
        }
        if (parsed.prompt.version !== undefined) {
          attributes['langfuse.observation.prompt.version'] = parsed.prompt.version;
        }
      }
    } catch {
      // best effort — invalid JSON is silently ignored
    }
    delete attributes['mastra.metadata.langfuse'];
  }

  // TTFT: mastra.completion_start_time → langfuse.observation.completion_start_time
  if (attributes['mastra.completion_start_time']) {
    attributes['langfuse.observation.completion_start_time'] = attributes['mastra.completion_start_time'];
    delete attributes['mastra.completion_start_time'];
  }

  // User ID: mastra.metadata.userId → user.id
  if (attributes['mastra.metadata.userId']) {
    attributes['user.id'] = attributes['mastra.metadata.userId'];
    delete attributes['mastra.metadata.userId'];
  }

  // Session ID: mastra.metadata.sessionId or threadId → session.id
  const sessionId = attributes['mastra.metadata.sessionId'] ?? attributes['mastra.metadata.threadId'];
  if (sessionId) {
    attributes['session.id'] = sessionId;
    delete attributes['mastra.metadata.sessionId'];
    delete attributes['mastra.metadata.threadId'];
  }

  // Tags: mastra.tags → langfuse.trace.tags
  if (attributes['mastra.tags']) {
    attributes['langfuse.trace.tags'] = attributes['mastra.tags'];
    delete attributes['mastra.tags'];
  }

  // Input/Output: mastra.*.input/output → langfuse.observation.input/output
  // For gen_ai spans, Langfuse reads gen_ai.input.messages natively.
  // For non-gen_ai spans, we map the first mastra.*.input/output we find.
  if (!attributes['gen_ai.input.messages'] && !attributes['gen_ai.tool.call.arguments']) {
    for (const key of Object.keys(attributes)) {
      if (key.startsWith('mastra.') && key.endsWith('.input')) {
        attributes['langfuse.observation.input'] = attributes[key];
        break;
      }
    }
  }
  if (!attributes['gen_ai.output.messages'] && !attributes['gen_ai.tool.call.result']) {
    for (const key of Object.keys(attributes)) {
      if (key.startsWith('mastra.') && key.endsWith('.output')) {
        attributes['langfuse.observation.output'] = attributes[key];
        break;
      }
    }
  }
}
