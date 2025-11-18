import type { TracingEvent, AnyExportedSpan, ModelGenerationAttributes } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { BaseExporter, type BaseExporterConfig } from '@mastra/observability';
import { PostHog } from 'posthog-node';

/**
 * PostHog message format (from PostHog LLM Analytics API spec)
 * https://posthog.com/docs/ai-engineering/llm-observability
 */
interface PostHogMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: PostHogContent[];
}

interface PostHogContent {
  type: string;
  text?: string;
  image_url?: string;
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

  constructor(config: PosthogExporterConfig) {
    super(config);
    this.config = config;

    if (!config.apiKey) {
      this.setDisabled('Missing required API key');
      // Create a no-op client to prevent runtime errors if methods are called
      this.client = null as any;
      return;
    }

    // Handle serverless auto-configuration
    // Serverless: flushAt=10, flushInterval=2000 (small batches, frequent flushing)
    // Normal: flushAt=20, flushInterval=10000 (PostHog SDK defaults)
    const isServerless = config.serverless ?? false;

    const flushAt = config.flushAt ?? (isServerless ? 10 : 20);
    const flushInterval = config.flushInterval ?? (isServerless ? 2000 : 10000);

    // Determine host with environment variable support and warning
    const host = config.host || process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

    if (!config.host && !process.env.POSTHOG_HOST) {
      this.logger.warn(
        'No PostHog host specified, using US default (https://us.i.posthog.com). ' +
          'For EU region, set `host: "https://eu.i.posthog.com"` in config or POSTHOG_HOST env var. ' +
          'For self-hosted, provide your instance URL.',
      );
    }

    this.client = new PostHog(config.apiKey, {
      host,
      flushAt,
      flushInterval,
    });

    if (isServerless) {
      this.logger.info('PostHog exporter initialized in serverless mode', {
        host,
        flushAt,
        flushInterval,
      });
    } else {
      this.logger.info('PostHog exporter initialized', {
        host,
        flushAt,
        flushInterval,
      });
    }
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
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
          await this.handleSpanUpdated(event.exportedSpan);
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
      startTime: new Date(span.startTime),
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

  private async handleSpanUpdated(span: AnyExportedSpan): Promise<void> {
    // PostHog events are atomic (captured at end), so updates are less critical
    // unless we need to update the cache for some reason.
    // For now, we don't need to do anything here.
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
    const endTime = span.endTime ? new Date(span.endTime).getTime() : Date.now();
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

    // Cleanup span
    traceData.spans.delete(span.id);

    // Cleanup trace if no more spans
    if (traceData.spans.size === 0) {
      this.traceMap.delete(span.traceId);
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

    // Error details
    if (span.errorInfo) {
      props.error_message = span.errorInfo.message;
      if (span.errorInfo.id) props.error_id = span.errorInfo.id;
      if (span.errorInfo.category) props.error_category = span.errorInfo.category;
    }

    // Custom metadata
    // Extract all metadata except userId and sessionId (already handled)
    const { userId, sessionId, ...customMetadata } = span.metadata ?? {};
    return { ...props, ...customMetadata };
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

    // Error details
    if (span.errorInfo) {
      props.error_message = span.errorInfo.message;
      if (span.errorInfo.id) props.error_id = span.errorInfo.id;
      if (span.errorInfo.category) props.error_category = span.errorInfo.category;
    }

    // Type-specific attributes (merge directly)
    if (span.attributes) {
      // Omit model attributes if they were accidentally included in non-generation span
      // but generally just merge them.
      Object.assign(props, span.attributes);
    }

    // Custom metadata
    const { userId, sessionId, ...customMetadata } = span.metadata ?? {};
    return { ...props, ...customMetadata };
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
    return (
      Array.isArray(data) &&
      data.length > 0 &&
      typeof data[0] === 'object' &&
      data[0] !== null &&
      'role' in data[0] &&
      'content' in data[0]
    );
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
   *
   * @param data - Data to stringify
   * @returns String representation
   */
  private safeStringify(data: unknown): string {
    try {
      return JSON.stringify(data);
    } catch {
      // Fallback for objects with circular references, etc.
      return String(data);
    }
  }
}
