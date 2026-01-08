import type { TracingEvent, AnyExportedSpan, ModelGenerationAttributes, UsageStats } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import type { BaseExporterConfig } from '@mastra/observability';
import { BaseExporter } from '@mastra/observability';
import { PostHog } from 'posthog-node';

/**
 * Token usage format compatible with PostHog.
 * @see https://posthog.com/docs/llm-analytics/generations#event-properties
 */
export interface PostHogUsageMetrics {
  $ai_input_tokens?: number;
  $ai_output_tokens?: number;
  $ai_cache_read_input_tokens?: number;
  $ai_cache_creation_input_tokens?: number;
}

/**
 * Formats UsageStats to PostHog's expected property format.
 *
 * @param usage - The UsageStats from span attributes
 * @returns PostHog-formatted usage properties
 */
export function formatUsageMetrics(usage?: UsageStats): PostHogUsageMetrics {
  if (!usage) return {};

  const props: PostHogUsageMetrics = {};

  if (usage.inputTokens !== undefined) props.$ai_input_tokens = usage.inputTokens;
  if (usage.outputTokens !== undefined) props.$ai_output_tokens = usage.outputTokens;

  // Cache read tokens from inputDetails
  if (usage.inputDetails?.cacheRead !== undefined) props.$ai_cache_read_input_tokens = usage.inputDetails.cacheRead;

  // Cache write tokens from inputDetails
  if (usage.inputDetails?.cacheWrite !== undefined)
    props.$ai_cache_creation_input_tokens = usage.inputDetails.cacheWrite;

  return props;
}

interface PostHogMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: PostHogContent[];
}

interface PostHogContent {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface MastraMessage {
  role: string;
  content: string | MastraContent[];
}

interface MastraContent {
  type: string;
  text?: string;
  [key: string]: unknown;
}

type SpanData = string | MastraMessage[] | Record<string, unknown> | unknown;

export interface PosthogExporterConfig extends BaseExporterConfig {
  /** PostHog API key. Defaults to POSTHOG_API_KEY environment variable. */
  apiKey?: string;
  /** PostHog host URL. Defaults to POSTHOG_HOST environment variable or US region. */
  host?: string;
  flushAt?: number;
  flushInterval?: number;
  serverless?: boolean;
  defaultDistinctId?: string;
  enablePrivacyMode?: boolean;
}

type SpanCache = {
  startTime: Date;
  type: SpanType;
  isRootSpan: boolean;
};

type TraceMetadata = {
  spans: Map<string, SpanCache>;
  distinctId?: string;
};

export class PosthogExporter extends BaseExporter {
  name = 'posthog';
  private client: PostHog | null;
  private config: PosthogExporterConfig;
  private traceMap = new Map<string, TraceMetadata>();

  private static readonly SERVERLESS_FLUSH_AT = 10;
  private static readonly SERVERLESS_FLUSH_INTERVAL = 2000;
  private static readonly DEFAULT_FLUSH_AT = 20;
  private static readonly DEFAULT_FLUSH_INTERVAL = 10000;

  constructor(config: PosthogExporterConfig = {}) {
    super(config);

    // Read API key from config or environment variable
    const apiKey = config.apiKey ?? process.env.POSTHOG_API_KEY;

    if (!apiKey) {
      this.setDisabled('Missing required API key. Set POSTHOG_API_KEY environment variable or pass apiKey in config.');
      this.client = null;
      this.config = config;
      return;
    }

    this.config = { ...config, apiKey };
    const clientConfig = this.buildClientConfig(this.config);
    this.client = new PostHog(apiKey, clientConfig);
    this.logInitialization(config.serverless ?? false, clientConfig);
  }

  private buildClientConfig(config: PosthogExporterConfig) {
    const isServerless = config.serverless ?? false;
    const flushAt =
      config.flushAt ?? (isServerless ? PosthogExporter.SERVERLESS_FLUSH_AT : PosthogExporter.DEFAULT_FLUSH_AT);
    const flushInterval =
      config.flushInterval ??
      (isServerless ? PosthogExporter.SERVERLESS_FLUSH_INTERVAL : PosthogExporter.DEFAULT_FLUSH_INTERVAL);

    const host = config.host || process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

    if (!config.host && !process.env.POSTHOG_HOST) {
      this.logger.warn(
        'No PostHog host specified, using US default (https://us.i.posthog.com). ' +
          'For EU region, set `host: "https://eu.i.posthog.com"` in config or POSTHOG_HOST env var. ' +
          'For self-hosted, provide your instance URL.',
      );
    }

    return {
      host,
      flushAt,
      flushInterval,
      privacyMode: config.enablePrivacyMode,
    };
  }

  private logInitialization(
    isServerless: boolean,
    config: { host: string; flushAt: number; flushInterval: number; privacyMode?: boolean },
  ): void {
    const message = isServerless ? 'PostHog exporter initialized in serverless mode' : 'PostHog exporter initialized';
    this.logger.debug(message, config);
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      if (event.exportedSpan.isEvent) {
        if (event.type === 'span_started') {
          await this.captureEventSpan(event.exportedSpan);
        }
        return;
      }

      switch (event.type) {
        case 'span_started':
          await this.handleSpanStarted(event.exportedSpan);
          break;
        case 'span_updated':
          break;
        case 'span_ended':
          await this.handleSpanEnded(event.exportedSpan);
          break;
      }
    } catch (error) {
      this.logger.error('PostHog exporter error', { error, event });
    }
  }

  private async handleSpanStarted(span: AnyExportedSpan): Promise<void> {
    let traceData = this.traceMap.get(span.traceId);

    if (!traceData) {
      traceData = {
        spans: new Map(),
        distinctId: undefined,
      };
      this.traceMap.set(span.traceId, traceData);
    }

    traceData.spans.set(span.id, {
      startTime: this.toDate(span.startTime),
      type: span.type,
      isRootSpan: span.isRootSpan,
    });

    if (!traceData.distinctId) {
      const userId = span.metadata?.userId;
      if (userId) {
        traceData.distinctId = String(userId);
      }
    }
  }

  private async handleSpanEnded(span: AnyExportedSpan): Promise<void> {
    const traceData = this.traceMap.get(span.traceId);

    if (!traceData) {
      return;
    }

    const cachedSpan = traceData.spans.get(span.id);
    if (!cachedSpan) {
      return;
    }

    const startTime = cachedSpan.startTime.getTime();
    const endTime = span.endTime ? this.toDate(span.endTime).getTime() : Date.now();
    const latency = (endTime - startTime) / 1000;

    const distinctId = this.getDistinctId(span, traceData);

    // For root spans, only send $ai_trace (not $ai_span) to avoid duplicate entries
    // For non-root spans, send $ai_span or $ai_generation as normal
    if (span.isRootSpan) {
      this.captureTraceEvent(span, distinctId, endTime);
    } else {
      const eventName = this.mapToPostHogEvent(span.type);

      // Check if parent is the root span - if so, use traceId as parent_id
      // since we don't create an $ai_span for root spans
      const parentIsRootSpan = this.isParentRootSpan(span, traceData);
      const properties = this.buildEventProperties(span, latency, parentIsRootSpan);

      this.client?.capture({
        distinctId,
        event: eventName,
        properties,
        timestamp: new Date(endTime),
      });
    }

    traceData.spans.delete(span.id);
    if (traceData.spans.size === 0) {
      this.traceMap.delete(span.traceId);
    }
  }

  /**
   * Capture an explicit $ai_trace event for root spans.
   * This gives us control over trace-level metadata like name and tags,
   * rather than relying on PostHog's pseudo-trace auto-creation.
   */
  private captureTraceEvent(span: AnyExportedSpan, distinctId: string, endTime: number): void {
    // Note: We don't set $ai_latency on $ai_trace events because PostHog
    // aggregates latency from child events. Setting it here causes double-counting.
    const traceProperties: Record<string, any> = {
      $ai_trace_id: span.traceId,
      $ai_span_name: span.name,
      $ai_is_error: !!span.errorInfo,
    };

    if (span.metadata?.sessionId) {
      traceProperties.$ai_session_id = span.metadata.sessionId;
    }

    if (span.input) {
      traceProperties.$ai_input_state = span.input;
    }

    if (span.output) {
      traceProperties.$ai_output_state = span.output;
    }

    if (span.errorInfo) {
      traceProperties.$ai_error = {
        message: span.errorInfo.message,
        ...(span.errorInfo.id && { id: span.errorInfo.id }),
        ...(span.errorInfo.category && { category: span.errorInfo.category }),
      };
    }

    // Add tags as custom properties (PostHog doesn't have native tag support on traces)
    if (span.tags?.length) {
      for (const tag of span.tags) {
        traceProperties[tag] = true;
      }
    }

    // Add custom metadata (excluding userId and sessionId which are handled separately)
    const { userId, sessionId, ...customMetadata } = span.metadata ?? {};
    Object.assign(traceProperties, customMetadata);

    this.client?.capture({
      distinctId,
      event: '$ai_trace',
      properties: traceProperties,
      timestamp: new Date(endTime),
    });
  }

  private async captureEventSpan(span: AnyExportedSpan): Promise<void> {
    const eventName = this.mapToPostHogEvent(span.type);
    const traceData = this.traceMap.get(span.traceId);

    const distinctId = this.getDistinctId(span, traceData);
    const properties = this.buildEventProperties(span, 0);

    this.client?.capture({
      distinctId,
      event: eventName,
      properties,
      timestamp: span.endTime ? new Date(span.endTime) : new Date(),
    });
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.shutdown();
    }
    this.traceMap.clear();
    await super.shutdown();
    this.logger.info('PostHog exporter shutdown complete');
  }

  private toDate(timestamp: Date | number): Date {
    return timestamp instanceof Date ? timestamp : new Date(timestamp);
  }

  private mapToPostHogEvent(spanType: SpanType): string {
    if (spanType == SpanType.MODEL_GENERATION) {
      return '$ai_generation';
    }
    return '$ai_span';
  }

  private getDistinctId(span: AnyExportedSpan, traceData?: TraceMetadata): string {
    if (span.metadata?.userId) {
      return String(span.metadata.userId);
    }

    if (traceData?.distinctId) {
      return traceData.distinctId;
    }

    if (this.config.defaultDistinctId) {
      return this.config.defaultDistinctId;
    }

    return 'anonymous';
  }

  /**
   * Check if the parent of this span is the root span.
   * We need this because we don't create $ai_span for root spans,
   * so children of root spans should use $ai_trace_id as their $ai_parent_id.
   */
  private isParentRootSpan(span: AnyExportedSpan, traceData: TraceMetadata): boolean {
    if (!span.parentSpanId) {
      return false;
    }

    // Look up the parent span in our cache to check if it's a root span
    const parentCache = traceData.spans.get(span.parentSpanId);
    if (parentCache) {
      return parentCache.isRootSpan;
    }

    // Parent not found in cache - shouldn't happen normally, but default to false
    return false;
  }

  private buildEventProperties(
    span: AnyExportedSpan,
    latency: number,
    parentIsRootSpan: boolean = false,
  ): Record<string, any> {
    const baseProperties: Record<string, any> = {
      $ai_trace_id: span.traceId,
      $ai_latency: latency,
      $ai_is_error: !!span.errorInfo,
    };

    if (span.parentSpanId) {
      // If parent is the root span, use trace_id as parent_id since we don't
      // create an $ai_span for root spans (only $ai_trace)
      baseProperties.$ai_parent_id = parentIsRootSpan ? span.traceId : span.parentSpanId;
    }

    if (span.metadata?.sessionId) {
      baseProperties.$ai_session_id = span.metadata.sessionId;
    }

    // Include tags for root spans (tags are only set on root spans by design)
    // PostHog doesn't allow setting tags directly, so we iterate through each tag
    // and set it as a property with value true
    if (span.isRootSpan && span.tags?.length) {
      for (const tag of span.tags) {
        baseProperties[tag] = true;
      }
    }

    if (span.type === SpanType.MODEL_GENERATION) {
      baseProperties.$ai_generation_id = span.id;
      return { ...baseProperties, ...this.buildGenerationProperties(span) };
    } else {
      baseProperties.$ai_span_id = span.id;
      baseProperties.$ai_span_name = span.name;
      return { ...baseProperties, ...this.buildSpanProperties(span) };
    }
  }

  private extractErrorProperties(span: AnyExportedSpan): Record<string, any> {
    if (!span.errorInfo) {
      return {};
    }

    const props: Record<string, string> = {
      error_message: span.errorInfo.message,
    };

    if (span.errorInfo.id) {
      props.error_id = span.errorInfo.id;
    }

    if (span.errorInfo.category) {
      props.error_category = span.errorInfo.category;
    }

    return props;
  }

  private extractCustomMetadata(span: AnyExportedSpan): Record<string, any> {
    const { userId, sessionId, ...customMetadata } = span.metadata ?? {};
    return customMetadata;
  }

  private buildGenerationProperties(span: AnyExportedSpan): Record<string, any> {
    const props: Record<string, any> = {};
    const attrs = (span.attributes ?? {}) as ModelGenerationAttributes;

    props.$ai_model = attrs.model || 'unknown-model';
    props.$ai_provider = attrs.provider || 'unknown-provider';

    if (span.input) props.$ai_input = this.formatMessages(span.input, 'user');
    if (span.output) props.$ai_output_choices = this.formatMessages(span.output, 'assistant');

    // Extract usage properties using the shared utility
    Object.assign(props, formatUsageMetrics(attrs.usage));

    if (attrs.parameters) {
      if (attrs.parameters.temperature !== undefined) props.$ai_temperature = attrs.parameters.temperature;
      if (attrs.parameters.maxOutputTokens !== undefined) props.$ai_max_tokens = attrs.parameters.maxOutputTokens;
    }
    if (attrs.streaming !== undefined) props.$ai_stream = attrs.streaming;

    return { ...props, ...this.extractErrorProperties(span), ...this.extractCustomMetadata(span) };
  }

  private buildSpanProperties(span: AnyExportedSpan): Record<string, any> {
    const props: Record<string, any> = {};

    if (span.input) props.$ai_input_state = span.input;
    if (span.output) props.$ai_output_state = span.output;

    if (span.type === SpanType.MODEL_CHUNK) {
      const attrs = span.attributes as any;
      if (attrs?.chunkType) props.chunk_type = attrs.chunkType;
      if (attrs?.sequenceNumber !== undefined) props.chunk_sequence_number = attrs.sequenceNumber;
    }

    if (span.attributes) {
      Object.assign(props, span.attributes);
    }

    return { ...props, ...this.extractErrorProperties(span), ...this.extractCustomMetadata(span) };
  }

  private formatMessages(data: SpanData, defaultRole: 'user' | 'assistant' = 'user'): PostHogMessage[] {
    if (this.isMessageArray(data)) {
      return data.map(msg => this.normalizeMessage(msg));
    }

    if (typeof data === 'string') {
      return [{ role: defaultRole, content: [{ type: 'text', text: data }] }];
    }

    return [{ role: defaultRole, content: [{ type: 'text', text: this.safeStringify(data) }] }];
  }

  private isMessageArray(data: unknown): data is MastraMessage[] {
    if (!Array.isArray(data) || data.length === 0) {
      return false;
    }

    return data.every(item => typeof item === 'object' && item !== null && 'role' in item && 'content' in item);
  }

  private normalizeMessage(msg: MastraMessage): PostHogMessage {
    if (typeof msg.content === 'string') {
      return {
        role: msg.role as PostHogMessage['role'],
        content: [{ type: 'text', text: msg.content }],
      };
    }

    return {
      role: msg.role as PostHogMessage['role'],
      content: msg.content as PostHogContent[],
    };
  }

  private safeStringify(data: unknown): string {
    try {
      return JSON.stringify(data);
    } catch {
      if (typeof data === 'object' && data !== null) {
        return `[Non-serializable ${data.constructor?.name || 'Object'}]`;
      }
      return String(data);
    }
  }
}
