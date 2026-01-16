/**
 * Laminar Exporter for Mastra Observability
 *
 * This exporter sends observability data to Laminar via OTLP/HTTP (protobuf).
 * It also implements addScoreToTrace() to attach scorer results in Laminar.
 */

import type {
  AnyExportedSpan,
  InitExporterOptions,
  ModelGenerationAttributes,
  TracingEvent,
  UsageStats,
} from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';
import type { BaseExporterConfig } from '@mastra/observability';
import { SpanKind, SpanStatusCode, TraceFlags } from '@opentelemetry/api';
import type { Attributes, HrTime, Link, SpanContext, SpanStatus } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { ReadableSpan, SpanExporter, TimedEvent } from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_TELEMETRY_SDK_LANGUAGE,
  ATTR_TELEMETRY_SDK_NAME,
  ATTR_TELEMETRY_SDK_VERSION,
} from '@opentelemetry/semantic-conventions';

// Laminar span attributes
const LMNR_SPAN_INPUT = 'lmnr.span.input';
const LMNR_SPAN_OUTPUT = 'lmnr.span.output';
const LMNR_SPAN_TYPE = 'lmnr.span.type';
const LMNR_SPAN_PATH = 'lmnr.span.path';
const LMNR_SPAN_IDS_PATH = 'lmnr.span.ids_path';
const LMNR_SPAN_INSTRUMENTATION_SOURCE = 'lmnr.span.instrumentation_source';
const LMNR_SPAN_SDK_VERSION = 'lmnr.span.sdk_version';
const LMNR_SPAN_LANGUAGE_VERSION = 'lmnr.span.language_version';

const LMNR_ASSOCIATION_PREFIX = 'lmnr.association.properties';
const LMNR_SESSION_ID = `${LMNR_ASSOCIATION_PREFIX}.session_id`;
const LMNR_USER_ID = `${LMNR_ASSOCIATION_PREFIX}.user_id`;
const LMNR_TAGS = `${LMNR_ASSOCIATION_PREFIX}.tags`;

// Laminar GenAI attributes (as used by Laminar backend)
const GEN_AI_SYSTEM = 'gen_ai.system';
const GEN_AI_REQUEST_MODEL = 'gen_ai.request.model';
const GEN_AI_RESPONSE_MODEL = 'gen_ai.response.model';
const GEN_AI_USAGE_INPUT_TOKENS = 'gen_ai.usage.input_tokens';
const GEN_AI_USAGE_OUTPUT_TOKENS = 'gen_ai.usage.output_tokens';
const GEN_AI_CACHE_WRITE_INPUT_TOKENS = 'gen_ai.usage.cache_creation_input_tokens';
const GEN_AI_CACHE_READ_INPUT_TOKENS = 'gen_ai.usage.cache_read_input_tokens';

type LaminarSpanType = 'DEFAULT' | 'LLM' | 'TOOL';

type TraceState = {
  spanPathById: Map<string, string[]>;
  spanIdsPathById: Map<string, string[]>;
  activeSpanIds: Set<string>;
};

type InstrumentationScope = {
  name: string;
  version?: string;
  schemaUrl?: string;
};

export interface LaminarExporterConfig extends BaseExporterConfig {
  /**
   * Laminar project API key. Defaults to `process.env.LMNR_PROJECT_API_KEY`.
   */
  apiKey?: string;
  /**
   * Base URL for Laminar APIs. Defaults to `process.env.LMNR_BASE_URL` or `https://api.lmnr.ai`.
   *
   * Used for:
   * - trace exports (if `endpoint`/`LAMINAR_ENDPOINT` are not set)
   * - evaluator scoring (`/v1/evaluators/score`)
   */
  baseUrl?: string;
  /**
   * Full OTLP/HTTP traces endpoint. Defaults to `process.env.LAMINAR_ENDPOINT` or `${baseUrl}/v1/traces`.
   */
  endpoint?: string;
  /**
   * Additional headers to include in OTLP requests.
   */
  headers?: Record<string, string>;
  /**
   * Flush after each span for near-realtime visibility.
   */
  realtime?: boolean;
  /**
   * Disable batching (uses SimpleSpanProcessor).
   */
  disableBatch?: boolean;
  /**
   * Max spans to export per batch (BatchSpanProcessor only).
   */
  batchSize?: number;
  /**
   * OTLP export timeout in milliseconds.
   */
  timeoutMillis?: number;
}

type ResolvedLaminarConfig = Required<Pick<LaminarExporterConfig, 'realtime' | 'disableBatch' | 'batchSize'>> & {
  apiKey: string;
  baseUrl: string;
  endpoint: string;
  headers: Record<string, string>;
  timeoutMillis: number;
};

export class LaminarExporter extends BaseExporter {
  name = 'laminar';

  private config: ResolvedLaminarConfig | null;
  private traceMap = new Map<string, TraceState>();

  private resource?: Resource;
  private scope?: InstrumentationScope;
  private processor?: BatchSpanProcessor | SimpleSpanProcessor;
  private exporter?: SpanExporter;
  private isSetup = false;

  constructor(config: LaminarExporterConfig = {}) {
    super(config);

    const apiKey = config.apiKey ?? process.env.LMNR_PROJECT_API_KEY;
    if (!apiKey) {
      this.setDisabled(
        'Missing required API key. Set LMNR_PROJECT_API_KEY environment variable or pass apiKey in config.',
      );
      this.config = null;
      return;
    }

    const envEndpoint = process.env.LAMINAR_ENDPOINT;
    const baseUrl = stripTrailingSlash(config.baseUrl ?? process.env.LMNR_BASE_URL ?? 'https://api.lmnr.ai');
    const endpoint = config.endpoint ?? envEndpoint ?? `${baseUrl}/v1/traces`;

    const headers: Record<string, string> = {
      ...config.headers,
      Authorization: `Bearer ${apiKey}`,
    };

    this.config = {
      apiKey,
      baseUrl,
      endpoint,
      headers,
      realtime: config.realtime ?? false,
      disableBatch: config.disableBatch ?? false,
      batchSize: config.batchSize ?? 512,
      timeoutMillis: config.timeoutMillis ?? 30000,
    };
  }

  init(options: InitExporterOptions): void {
    // Build resource & scope lazily so we can include serviceName.
    const serviceName = options.config?.serviceName || 'mastra-service';

    this.resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: 'unknown',
      [ATTR_TELEMETRY_SDK_NAME]: '@mastra/laminar',
      [ATTR_TELEMETRY_SDK_VERSION]: 'unknown',
      [ATTR_TELEMETRY_SDK_LANGUAGE]: 'nodejs',
    });

    this.scope = {
      name: '@mastra/laminar',
      version: 'unknown',
    };
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    // Track hierarchy on span start to build lmnr.span.path/ids_path for child spans.
    if (event.type === TracingEventType.SPAN_STARTED && !event.exportedSpan.isEvent) {
      this.handleSpanStarted(event.exportedSpan);
      return;
    }

    // Only export when the span is ended (including event spans).
    if (event.type !== TracingEventType.SPAN_ENDED) {
      return;
    }

    await this.handleSpanEnded(event.exportedSpan);
  }

  private handleSpanStarted(span: AnyExportedSpan): void {
    const traceState = this.getOrCreateTraceState(span.traceId);
    const name = span.name;

    const parentId = span.parentSpanId;
    const parentPath = parentId ? traceState.spanPathById.get(parentId) : undefined;
    const parentIdsPath = parentId ? traceState.spanIdsPathById.get(parentId) : undefined;

    const spanPath = parentPath ? [...parentPath, name] : [name];
    const spanIdsPath = parentIdsPath ? [...parentIdsPath, otelSpanIdToUUID(span.id)] : [otelSpanIdToUUID(span.id)];

    traceState.spanPathById.set(span.id, spanPath);
    traceState.spanIdsPathById.set(span.id, spanIdsPath);
    traceState.activeSpanIds.add(span.id);
  }

  private async handleSpanEnded(span: AnyExportedSpan): Promise<void> {
    if (!this.config) {
      return;
    }

    await this.setupIfNeeded();

    if (!this.processor || !this.exporter) {
      return;
    }

    const traceState = this.getOrCreateTraceState(span.traceId);

    // Ensure we have path data even for event spans (which never emit SPAN_STARTED).
    if (!traceState.spanPathById.has(span.id) || !traceState.spanIdsPathById.has(span.id)) {
      const name = span.name;
      const parentId = span.parentSpanId;
      const parentPath = parentId ? traceState.spanPathById.get(parentId) : undefined;
      const parentIdsPath = parentId ? traceState.spanIdsPathById.get(parentId) : undefined;

      const spanPath = parentPath ? [...parentPath, name] : [name];
      const spanIdsPath = parentIdsPath ? [...parentIdsPath, otelSpanIdToUUID(span.id)] : [otelSpanIdToUUID(span.id)];

      traceState.spanPathById.set(span.id, spanPath);
      traceState.spanIdsPathById.set(span.id, spanIdsPath);
    }

    try {
      const otelSpan = this.convertSpanToOtel(span, traceState);
      this.processor.onEnd(otelSpan);

      if (this.config.realtime) {
        await this.processor.forceFlush();
      }
    } catch (error) {
      this.logger.error('[LaminarExporter] Failed to export span', { error, spanId: span.id, traceId: span.traceId });
    } finally {
      // Refcount cleanup (non-event spans only; event spans never enter active set)
      traceState.activeSpanIds.delete(span.id);

      if (traceState.activeSpanIds.size === 0) {
        this.traceMap.delete(span.traceId);
      }
    }
  }

  private getOrCreateTraceState(traceId: string): TraceState {
    const existing = this.traceMap.get(traceId);
    if (existing) return existing;

    const created: TraceState = {
      spanPathById: new Map(),
      spanIdsPathById: new Map(),
      activeSpanIds: new Set(),
    };
    this.traceMap.set(traceId, created);
    return created;
  }

  private convertSpanToOtel(span: AnyExportedSpan, traceState: TraceState): ReadableSpan {
    if (!this.resource || !this.scope) {
      // init() is optional; fall back to defaults if it wasn't called for some reason.
      this.resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'mastra-service',
        [ATTR_SERVICE_VERSION]: 'unknown',
        [ATTR_TELEMETRY_SDK_NAME]: '@mastra/laminar',
        [ATTR_TELEMETRY_SDK_VERSION]: 'unknown',
        [ATTR_TELEMETRY_SDK_LANGUAGE]: 'nodejs',
      });
      this.scope = { name: '@mastra/laminar', version: 'unknown' };
    }

    const name = span.name;
    const kind = getSpanKind(span.type);

    const startTime = dateToHrTime(span.startTime);
    const endTime = span.endTime ? dateToHrTime(span.endTime) : startTime;
    const duration = computeDuration(span.startTime, span.endTime);

    const { status, events } = buildStatusAndEvents(span, startTime);

    const traceId = normalizeTraceId(span.traceId);
    const spanId = normalizeSpanId(span.id);

    const spanContext: SpanContext = {
      traceId,
      spanId,
      traceFlags: TraceFlags.SAMPLED,
      isRemote: false,
    };

    const parentSpanContext = span.parentSpanId
      ? {
          traceId,
          spanId: normalizeSpanId(span.parentSpanId),
          traceFlags: TraceFlags.SAMPLED,
          isRemote: false,
        }
      : undefined;

    const attributes = buildLaminarAttributes(span, traceState);

    const links: Link[] = [];

    const readable: ReadableSpan = {
      name,
      kind,
      spanContext: () => spanContext,
      parentSpanContext,
      startTime,
      endTime,
      status,
      attributes,
      links,
      events,
      duration,
      ended: true,
      resource: this.resource,
      instrumentationScope: this.scope,
      droppedAttributesCount: 0,
      droppedEventsCount: 0,
      droppedLinksCount: 0,
    };

    return readable;
  }

  private async setupIfNeeded(): Promise<void> {
    if (this.isSetup || !this.config) {
      return;
    }

    this.exporter = new OTLPTraceExporter({
      url: this.config.endpoint,
      headers: this.config.headers,
      timeoutMillis: this.config.timeoutMillis,
    });

    this.processor = this.config.disableBatch
      ? new SimpleSpanProcessor(this.exporter)
      : new BatchSpanProcessor(this.exporter, {
          maxExportBatchSize: this.config.batchSize,
          exportTimeoutMillis: this.config.timeoutMillis,
        });

    this.isSetup = true;
  }

  async _addScoreToTrace({
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
    if (!this.config) return;

    const payload: Record<string, unknown> = {
      name: scorerName,
      score,
      source: 'Code',
      metadata: { ...(metadata ?? {}), ...(reason ? { reason } : {}) },
    };

    if (spanId) {
      payload.spanId = otelSpanIdToUUID(spanId);
    } else {
      payload.traceId = otelTraceIdToUUID(traceId);
    }

    try {
      const scoreHeaders: Record<string, string> = {
        Authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
      };

      const response = await fetch(`${stripTrailingSlash(this.config.baseUrl)}/v1/evaluators/score`, {
        method: 'POST',
        headers: scoreHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn('[LaminarExporter] Failed to attach score to trace/span', {
          status: response.status,
          statusText: response.statusText,
          traceId,
          spanId,
          scorerName,
        });
      }
    } catch (error) {
      this.logger.error('[LaminarExporter] Error attaching score to trace/span', {
        error,
        traceId,
        spanId,
        scorerName,
      });
    }
  }

  /**
   * Force flush any buffered spans without shutting down the exporter.
   * This is useful in serverless environments where you need to ensure spans
   * are exported before the runtime instance is terminated.
   */
  async flush(): Promise<void> {
    if (this.isDisabled || !this.processor) return;

    try {
      await this.processor.forceFlush();
      this.logger.debug('[LaminarExporter] Flushed pending spans');
    } catch (error) {
      this.logger.error('[LaminarExporter] Error flushing spans', { error });
    }
  }

  async shutdown(): Promise<void> {
    try {
      await this.processor?.shutdown();
    } finally {
      this.traceMap.clear();
      await super.shutdown();
    }
  }
}

function buildLaminarAttributes(span: AnyExportedSpan, traceState: TraceState): Attributes {
  const attributes: Attributes = {};

  const spanPath = traceState.spanPathById.get(span.id);
  const spanIdsPath = traceState.spanIdsPathById.get(span.id);

  if (spanPath) {
    attributes[LMNR_SPAN_PATH] = spanPath;
  }

  if (spanIdsPath) {
    attributes[LMNR_SPAN_IDS_PATH] = spanIdsPath;
  }

  attributes[LMNR_SPAN_TYPE] = mapLaminarSpanType(span.type);
  attributes[LMNR_SPAN_INSTRUMENTATION_SOURCE] = 'javascript';

  // These attributes are optional in Laminar, but helpful for debugging.
  attributes[LMNR_SPAN_SDK_VERSION] = 'unknown';
  attributes[LMNR_SPAN_LANGUAGE_VERSION] = process.version;

  // Association properties
  const sessionId = span.metadata?.sessionId;
  if (typeof sessionId === 'string' && sessionId.length > 0) {
    attributes[LMNR_SESSION_ID] = sessionId;
  }

  const userId = span.metadata?.userId;
  if (typeof userId === 'string' && userId.length > 0) {
    attributes[LMNR_USER_ID] = userId;
  }

  // Attach Mastra metadata as Laminar trace/span metadata (best-effort, scalar/array-only)
  // Laminar treats `lmnr.association.properties.metadata.*` as freeform metadata.
  if (span.metadata) {
    for (const [key, value] of Object.entries(span.metadata)) {
      if (key === 'sessionId' || key === 'userId' || value === undefined || value === null) {
        continue;
      }

      const attributeValue = toLaminarAttributeValue(value);
      if (attributeValue === undefined) {
        continue;
      }

      attributes[`${LMNR_ASSOCIATION_PREFIX}.metadata.${key}`] = attributeValue;
    }
  }

  if (span.isRootSpan && span.tags?.length) {
    attributes[LMNR_TAGS] = span.tags;
  }

  // Span input/output (Laminar prefers these over gen_ai.* / other conventions)
  if (span.input !== undefined) {
    attributes[LMNR_SPAN_INPUT] = serializeForLaminar(getLaminarSpanInput(span));
  }

  if (span.output !== undefined) {
    attributes[LMNR_SPAN_OUTPUT] = serializeForLaminar(span.output);
  }

  if (span.type === SpanType.MODEL_GENERATION) {
    const modelAttrs = (span.attributes ?? {}) as ModelGenerationAttributes;

    if (modelAttrs.provider) {
      attributes[GEN_AI_SYSTEM] = normalizeProvider(modelAttrs.provider);
    }

    if (modelAttrs.model) {
      attributes[GEN_AI_REQUEST_MODEL] = modelAttrs.model;
    }

    if (modelAttrs.responseModel) {
      attributes[GEN_AI_RESPONSE_MODEL] = modelAttrs.responseModel;
    }

    Object.assign(attributes, formatLaminarUsage(modelAttrs.usage));
  }

  return attributes;
}

function mapLaminarSpanType(spanType: SpanType): LaminarSpanType {
  switch (spanType) {
    case SpanType.MODEL_GENERATION:
    case SpanType.MODEL_STEP:
    case SpanType.MODEL_CHUNK:
      return 'LLM';
    case SpanType.TOOL_CALL:
    case SpanType.MCP_TOOL_CALL:
      return 'TOOL';
    default:
      return 'DEFAULT';
  }
}

function formatLaminarUsage(usage?: UsageStats): Attributes {
  if (!usage) return {};

  const out: Attributes = {};

  if (usage.inputTokens !== undefined) {
    out[GEN_AI_USAGE_INPUT_TOKENS] = usage.inputTokens;
  }

  if (usage.outputTokens !== undefined) {
    out[GEN_AI_USAGE_OUTPUT_TOKENS] = usage.outputTokens;
  }

  if (usage.inputDetails?.cacheWrite !== undefined) {
    out[GEN_AI_CACHE_WRITE_INPUT_TOKENS] = usage.inputDetails.cacheWrite;
  }

  if (usage.inputDetails?.cacheRead !== undefined) {
    out[GEN_AI_CACHE_READ_INPUT_TOKENS] = usage.inputDetails.cacheRead;
  }

  return out;
}

function serializeForLaminar(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function getLaminarSpanInput(span: AnyExportedSpan): unknown {
  // Mastra MODEL_GENERATION spans commonly use `{ messages, ... }` as input.
  // Laminar can render rich chat views when `lmnr.span.input` is a message list.
  if (span.type !== SpanType.MODEL_GENERATION) {
    return span.input;
  }

  const input = span.input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }

  const maybeMessages = (input as { messages?: unknown }).messages;
  return Array.isArray(maybeMessages) ? maybeMessages : input;
}

function toLaminarAttributeValue(value: unknown): Attributes[string] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    const isHomogeneous =
      value.every(v => typeof v === 'string') ||
      value.every(v => typeof v === 'number') ||
      value.every(v => typeof v === 'boolean');
    if (isHomogeneous) return value;
  }

  return serializeForLaminar(value);
}

/**
 * Convert JavaScript Date to hrtime format
 */
function dateToHrTime(date: Date): HrTime {
  const ms = date.getTime();
  const seconds = Math.floor(ms / 1000);
  const nanoseconds = (ms % 1000) * 1_000_000;
  return [seconds, nanoseconds];
}

function computeDuration(start: Date, end?: Date): HrTime {
  if (!end) return [0, 0];
  const diffMs = end.getTime() - start.getTime();
  return [Math.floor(diffMs / 1000), (diffMs % 1000) * 1_000_000];
}

function buildStatusAndEvents(
  span: AnyExportedSpan,
  defaultTime: HrTime,
): { status: SpanStatus; events: TimedEvent[] } {
  const events: TimedEvent[] = [];

  if (span.errorInfo) {
    const status: SpanStatus = {
      code: SpanStatusCode.ERROR,
      message: span.errorInfo.message,
    };

    events.push({
      name: 'exception',
      attributes: {
        'exception.message': span.errorInfo.message,
        'exception.type': 'Error',
        ...(span.errorInfo.details?.stack && {
          'exception.stacktrace': span.errorInfo.details.stack as string,
        }),
      },
      time: defaultTime,
      droppedAttributesCount: 0,
    });

    return { status, events };
  }

  return {
    status: { code: SpanStatusCode.OK },
    events,
  };
}

function getSpanKind(type: SpanType): SpanKind {
  switch (type) {
    case SpanType.MODEL_GENERATION:
    case SpanType.MCP_TOOL_CALL:
      return SpanKind.CLIENT;
    default:
      return SpanKind.INTERNAL;
  }
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/g, '');
}

function normalizeTraceId(traceId: string): string {
  let id = traceId.toLowerCase();
  if (id.startsWith('0x')) id = id.slice(2);
  return id.padStart(32, '0').slice(-32);
}

function normalizeSpanId(spanId: string): string {
  let id = spanId.toLowerCase();
  if (id.startsWith('0x')) id = id.slice(2);
  return id.padStart(16, '0').slice(-16);
}

export function otelSpanIdToUUID(spanId: string): string {
  const normalized = normalizeSpanId(spanId);
  return normalized
    .padStart(32, '0')
    .replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/, '$1-$2-$3-$4-$5');
}

export function otelTraceIdToUUID(traceId: string): string {
  const normalized = normalizeTraceId(traceId);
  return normalized.replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/, '$1-$2-$3-$4-$5');
}

function normalizeProvider(provider: string): string {
  return provider.split('.').shift()?.toLowerCase().trim() || provider.toLowerCase().trim();
}
