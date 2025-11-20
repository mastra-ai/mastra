import type { TracingEvent, AnyExportedSpan, ModelGenerationAttributes } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { BaseExporter, type BaseExporterConfig } from '@mastra/observability';
import { PostHog } from 'posthog-node';

/**
 * PostHog message format (from PostHog LLM Analytics API spec)
 */
interface PostHogMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: PostHogContent[];
}

interface PostHogContent {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/**
 * Mastra's possible message formats (AI SDK compatible)
 */
interface MastraMessage {
  role: string;
  content: string | MastraContent[];
}

interface MastraContent {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/**
 * Union type for all possible Mastra span input/output
 */
type SpanData =
  | string // Plain string input
  | MastraMessage[] // Message array (AI SDK format)
  | Record<string, unknown> // Object (tool params, workflow state, etc.)
  | unknown; // Fallback for edge cases

export interface PosthogExporterConfig extends BaseExporterConfig {
  apiKey: string;
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
};

type TraceMetadata = {
  spans: Map<string, SpanCache>;
  distinctId?: string;
};

export class PosthogExporter extends BaseExporter {
  name = 'posthog';
  private client: PostHog;
  private config: PosthogExporterConfig;
  private traceMap = new Map<string, TraceMetadata>();

  // PostHog flush configuration constants
  private static readonly SERVERLESS_FLUSH_AT = 10;
  private static readonly SERVERLESS_FLUSH_INTERVAL = 2000; // 2 seconds
  private static readonly DEFAULT_FLUSH_AT = 20;
  private static readonly DEFAULT_FLUSH_INTERVAL = 10000; // 10 seconds

  constructor(config: PosthogExporterConfig) {
    super(config);
    this.config = config;

    if (!config.apiKey) {
      this.setDisabled('Missing required API key');
      // Create a no-op client to prevent runtime errors if methods are called
      this.client = null as any;
      return;
    }

    const clientConfig = this.buildClientConfig(config);
    this.client = new PostHog(config.apiKey, clientConfig);
    this.logInitialization(config.serverless ?? false, clientConfig);
  }

  /**
   * Build PostHog client configuration with serverless auto-configuration
   * Serverless: flushAt=10, flushInterval=2000 (small batches, frequent flushing)
   * Normal: flushAt=20, flushInterval=10000 (PostHog SDK defaults)
   */
  private buildClientConfig(config: PosthogExporterConfig): {
    host: string;
    flushAt: number;
    flushInterval: number;
  } {
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

    return { host, flushAt, flushInterval };
  }

  /**
   * Log initialization details based on serverless mode
   */
  private logInitialization(
    isServerless: boolean,
    config: { host: string; flushAt: number; flushInterval: number },
  ): void {
    const message = isServerless ? 'PostHog exporter initialized in serverless mode' : 'PostHog exporter initialized';

    this.logger.info(message, config);
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    // Early return if client is not initialized (disabled exporter)
    if (!this.client) return;

    try {
      if (event.exportedSpan.isEvent) {
        await this.captureEventSpan(event.exportedSpan);
        return;
      }

      switch (event.type) {
        case 'span_started':
          await this.handleSpanStarted(event.exportedSpan);
          break;
        case 'span_updated':
          // PostHog events are atomic (captured at end), no action needed for updates
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

    // Cache the span start time and type
    traceData.spans.set(span.id, {
      startTime: this.toDate(span.startTime),
      type: span.type,
    });

    // If root span or if distinctId not yet set, try to set it
    if (span.parentSpanId === undefined || !traceData.distinctId) {
      // Prioritize userId from metadata
      const userId = span.metadata?.userId;
      if (userId) {
        traceData.distinctId = String(userId);
      }
    }
  }

  private async handleSpanEnded(span: AnyExportedSpan): Promise<void> {
    const traceData = this.traceMap.get(span.traceId);

    if (!traceData) {
      this.logger.warn(`Trace data not found for ended span: ${span.id}`);
      return;
    }

    const cachedSpan = traceData.spans.get(span.id);
    if (!cachedSpan) {
      // It's possible we missed the start event or it was evicted
      this.logger.warn(`Span cache not found for ended span: ${span.id}`);
      return;
    }

    // Calculate latency in seconds
    const startTime = cachedSpan.startTime.getTime();
    const endTime = span.endTime ? this.toDate(span.endTime).getTime() : Date.now();
    const latency = (endTime - startTime) / 1000;

    // Build event
    const eventName = this.mapToPostHogEvent(span.type);
    const distinctId = this.getDistinctId(span, traceData);
    const properties = this.buildEventProperties(span, latency, traceData);

    // Capture
    this.client.capture({
      distinctId,
      event: eventName,
      properties,
      timestamp: new Date(endTime),
    });

    // Cleanup
    this.cleanupSpan(span.traceId, span.id);
  }

  /**
   * Remove span from cache and cleanup trace if empty
   */
  private cleanupSpan(traceId: string, spanId: string): void {
    const traceData = this.traceMap.get(traceId);
    if (!traceData) return;

    traceData.spans.delete(spanId);

    // Cleanup trace if no more spans
    if (traceData.spans.size === 0) {
      this.traceMap.delete(traceId);
    }
  }

  private async captureEventSpan(span: AnyExportedSpan): Promise<void> {
    // Event spans (isEvent: true) are instant events, not ranges.
    // We assume they come in as ended or single point in time.
    // We can treat them as latency 0.

    const eventName = this.mapToPostHogEvent(span.type);
    // For event spans, we might not have traceData if it's a standalone event,
    // but typically they are part of a trace.
    const traceData = this.traceMap.get(span.traceId);

    const distinctId = this.getDistinctId(span, traceData);
    const properties = this.buildEventProperties(span, 0, traceData);

    this.client.capture({
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

  // -- Helpers --

  /**
   * Convert timestamp to Date object (handles both Date and number types)
   */
  private toDate(timestamp: Date | number): Date {
    return timestamp instanceof Date ? timestamp : new Date(timestamp);
  }

  private mapToPostHogEvent(spanType: SpanType): string {
    switch (spanType) {
      case SpanType.MODEL_GENERATION:
      case SpanType.MODEL_STEP:
        return '$ai_generation';
      case SpanType.MODEL_CHUNK:
      case SpanType.TOOL_CALL:
      case SpanType.MCP_TOOL_CALL:
      case SpanType.PROCESSOR_RUN:
      case SpanType.AGENT_RUN:
      case SpanType.WORKFLOW_RUN:
      case SpanType.GENERIC:
      default:
        return '$ai_span';
    }
  }

  private getDistinctId(span: AnyExportedSpan, traceData?: TraceMetadata): string {
    // Priority 1: span.metadata?.userId
    if (span.metadata?.userId) {
      return String(span.metadata.userId);
    }

    // Priority 2: traceData?.distinctId (cached from root span)
    if (traceData?.distinctId) {
      return traceData.distinctId;
    }

    // Priority 3: config.defaultDistinctId
    if (this.config.defaultDistinctId) {
      return this.config.defaultDistinctId;
    }

    // Priority 4: 'anonymous'
    return 'anonymous';
  }

  private buildEventProperties(span: AnyExportedSpan, latency: number, traceData?: TraceMetadata): Record<string, any> {
    const baseProperties: Record<string, any> = {
      $ai_trace_id: span.traceId,
      $ai_latency: latency,
      $ai_is_error: !!span.errorInfo,
    };

    // Add parent ID if not root
    if (span.parentSpanId) {
      baseProperties.$ai_parent_id = span.parentSpanId;
    }

    // Add session ID if present
    if (span.metadata?.sessionId) {
      baseProperties.$ai_session_id = span.metadata.sessionId;
    }

    // Route to type-specific builder
    if (span.type === SpanType.MODEL_GENERATION || span.type === SpanType.MODEL_STEP) {
      baseProperties.$ai_generation_id = span.id;
      return { ...baseProperties, ...this.buildGenerationProperties(span) };
    } else {
      baseProperties.$ai_span_id = span.id;
      baseProperties.$ai_span_name = span.name;
      return { ...baseProperties, ...this.buildSpanProperties(span) };
    }
  }

  /**
   * Extract error information from span into properties
   */
  private extractErrorProperties(span: AnyExportedSpan): Record<string, any> {
    if (!span.errorInfo) {
      return {};
    }

    const props: Record<string, any> = {
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

  /**
   * Extract custom metadata, excluding userId and sessionId (handled separately)
   */
  private extractCustomMetadata(span: AnyExportedSpan): Record<string, any> {
    const { userId, sessionId, ...customMetadata } = span.metadata ?? {};
    return customMetadata;
  }

  private buildGenerationProperties(span: AnyExportedSpan): Record<string, any> {
    const props: Record<string, any> = {};
    const attrs = (span.attributes ?? {}) as ModelGenerationAttributes;

    // Model information
    if (attrs.model) props.$ai_model = attrs.model;
    if (attrs.provider) props.$ai_provider = attrs.provider;

    // Input/Output (respect privacy mode)
    if (!this.config.enablePrivacyMode) {
      if (span.input) props.$ai_input = this.formatMessages(span.input);
      if (span.output) props.$ai_output_choices = this.formatMessages(span.output);
    }

    // Token usage
    if (attrs.usage) {
      const { usage } = attrs;
      // Handle v4/v5 formats
      const inputTokens = usage.inputTokens ?? usage.promptTokens;
      const outputTokens = usage.outputTokens ?? usage.completionTokens;
      const totalTokens = usage.totalTokens;

      if (inputTokens !== undefined) props.$ai_input_tokens = inputTokens;
      if (outputTokens !== undefined) props.$ai_output_tokens = outputTokens;
      if (totalTokens !== undefined) props.$ai_total_tokens = totalTokens;

      // v5 specific
      if (usage.reasoningTokens !== undefined) props.reasoning_tokens = usage.reasoningTokens;
      if (usage.cachedInputTokens !== undefined) props.cached_input_tokens = usage.cachedInputTokens;
    }

    // Model parameters
    if (attrs.parameters) {
      if (attrs.parameters.temperature !== undefined) props.$ai_temperature = attrs.parameters.temperature;
      if (attrs.parameters.maxOutputTokens !== undefined) props.$ai_max_tokens = attrs.parameters.maxOutputTokens;
    }
    if (attrs.streaming !== undefined) props.$ai_stream = attrs.streaming;

    // Error details and custom metadata
    return { ...props, ...this.extractErrorProperties(span), ...this.extractCustomMetadata(span) };
  }

  private buildSpanProperties(span: AnyExportedSpan): Record<string, any> {
    const props: Record<string, any> = {};

    // Input/Output state (no privacy filtering for regular spans, usually technical)
    if (span.input) props.$ai_input_state = span.input;
    if (span.output) props.$ai_output_state = span.output;

    // MODEL_CHUNK specific
    if (span.type === SpanType.MODEL_CHUNK) {
      const attrs = span.attributes as any;
      if (attrs?.chunkType) props.chunk_type = attrs.chunkType;
      if (attrs?.sequenceNumber !== undefined) props.chunk_sequence_number = attrs.sequenceNumber;
    }

    // Type-specific attributes (merge directly)
    if (span.attributes) {
      // Omit model attributes if they were accidentally included in non-generation span
      // but generally just merge them.
      Object.assign(props, span.attributes);
    }

    // Error details and custom metadata
    return { ...props, ...this.extractErrorProperties(span), ...this.extractCustomMetadata(span) };
  }

  /**
   * Format Mastra's flexible input/output to PostHog's strict message array format
   *
   * @param data - Mastra span input or output (can be string, message array, or object)
   * @returns PostHog-compatible message array
   */
  private formatMessages(data: SpanData): PostHogMessage[] {
    // Case 1: Message array - normalize to PostHog format
    if (this.isMessageArray(data)) {
      return data.map(msg => this.normalizeMessage(msg));
    }

    // Case 2: Plain string - wrap in user message
    if (typeof data === 'string') {
      return [{ role: 'user', content: [{ type: 'text', text: data }] }];
    }

    // Case 3: Object/other - stringify and wrap
    return [{ role: 'user', content: [{ type: 'text', text: this.safeStringify(data) }] }];
  }

  /**
   * Type guard: Check if data is a message array
   *
   * @param data - Unknown data to check
   * @returns true if data is an array of message objects
   */
  private isMessageArray(data: unknown): data is MastraMessage[] {
    if (!Array.isArray(data) || data.length === 0) {
      return false;
    }

    // Check all elements to ensure they're message objects
    return data.every(item => typeof item === 'object' && item !== null && 'role' in item && 'content' in item);
  }

  /**
   * Normalize a single Mastra message to PostHog format
   * Converts string content to structured content array
   *
   * @param msg - Mastra message (may have string or array content)
   * @returns PostHog message with structured content array
   */
  private normalizeMessage(msg: MastraMessage): PostHogMessage {
    // String content → convert to structured format
    if (typeof msg.content === 'string') {
      return {
        role: msg.role as PostHogMessage['role'],
        content: [{ type: 'text', text: msg.content }],
      };
    }

    // Already structured → pass through
    return {
      role: msg.role as PostHogMessage['role'],
      content: msg.content as PostHogContent[],
    };
  }

  /**
   * Safe stringify with fallback for non-JSON-serializable objects
   * Handles circular references and other JSON.stringify errors gracefully
   *
   * @param data - Data to stringify
   * @returns String representation
   */
  private safeStringify(data: unknown): string {
    try {
      return JSON.stringify(data);
    } catch (error) {
      // Fallback for circular references, functions, etc.
      if (typeof data === 'object' && data !== null) {
        return `[Non-serializable ${data.constructor?.name || 'Object'}]`;
      }
      return String(data);
    }
  }
}
