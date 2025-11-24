import type { TracingEvent, AnyExportedSpan, ModelGenerationAttributes } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import type { BaseExporterConfig } from '@mastra/observability';
import { BaseExporter } from '@mastra/observability';
import { PostHog } from 'posthog-node';

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

  private static readonly SERVERLESS_FLUSH_AT = 10;
  private static readonly SERVERLESS_FLUSH_INTERVAL = 2000;
  private static readonly DEFAULT_FLUSH_AT = 20;
  private static readonly DEFAULT_FLUSH_INTERVAL = 10000;

  constructor(config: PosthogExporterConfig) {
    super(config);
    this.config = config;

    if (!config.apiKey) {
      this.setDisabled('Missing required API key');
      this.client = null as any;
      return;
    }

    const clientConfig = this.buildClientConfig(config);
    this.client = new PostHog(config.apiKey, clientConfig);
    this.logInitialization(config.serverless ?? false, clientConfig);
  }

  private buildClientConfig(config: PosthogExporterConfig): {
    host: string;
    flushAt: number;
    flushInterval: number;
    privacyMode?: boolean;
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

    return {
      host,
      flushAt,
      flushInterval,
      privacyMode: config.enablePrivacyMode,
    };
  }

  private logInitialization(
    isServerless: boolean,
    config: { host: string; flushAt: number; flushInterval: number },
  ): void {
    const message = isServerless ? 'PostHog exporter initialized in serverless mode' : 'PostHog exporter initialized';

    this.logger.info(message, config);
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (!this.client) return;

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
      this.logger.warn(`Trace data not found for ended span: ${span.id}`);
      return;
    }

    const cachedSpan = traceData.spans.get(span.id);
    if (!cachedSpan) {
      this.logger.warn(`Span cache not found for ended span: ${span.id}`);
      return;
    }

    const startTime = cachedSpan.startTime.getTime();
    const endTime = span.endTime ? this.toDate(span.endTime).getTime() : Date.now();
    const latency = (endTime - startTime) / 1000;

    const eventName = this.mapToPostHogEvent(span.type);
    const distinctId = this.getDistinctId(span, traceData);
    const properties = this.buildEventProperties(span, latency);

    this.client.capture({
      distinctId,
      event: eventName,
      properties,
      timestamp: new Date(endTime),
    });

    traceData.spans.delete(span.id);
    if (traceData.spans.size === 0) {
      this.traceMap.delete(span.traceId);
    }
  }

  private async captureEventSpan(span: AnyExportedSpan): Promise<void> {
    const eventName = this.mapToPostHogEvent(span.type);
    const traceData = this.traceMap.get(span.traceId);

    const distinctId = this.getDistinctId(span, traceData);
    const properties = this.buildEventProperties(span, 0);

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

  private buildEventProperties(span: AnyExportedSpan, latency: number): Record<string, any> {
    const baseProperties: Record<string, any> = {
      $ai_trace_id: span.traceId,
      $ai_latency: latency,
      $ai_is_error: !!span.errorInfo,
    };

    if (span.parentSpanId) {
      baseProperties.$ai_parent_id = span.parentSpanId;
    }

    if (span.metadata?.sessionId) {
      baseProperties.$ai_session_id = span.metadata.sessionId;
    }

    if (span.type === SpanType.MODEL_GENERATION || span.type === SpanType.MODEL_STEP) {
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

    if (attrs.usage) {
      const { usage } = attrs;
      const inputTokens = usage.inputTokens ?? usage.promptTokens;
      const outputTokens = usage.outputTokens ?? usage.completionTokens;
      const totalTokens = usage.totalTokens;

      if (inputTokens !== undefined) props.$ai_input_tokens = inputTokens;
      if (outputTokens !== undefined) props.$ai_output_tokens = outputTokens;
      if (totalTokens !== undefined) props.$ai_total_tokens = totalTokens;

      if (usage.reasoningTokens !== undefined) props.reasoning_tokens = usage.reasoningTokens;
      if (usage.cachedInputTokens !== undefined) props.cached_input_tokens = usage.cachedInputTokens;
    }

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
