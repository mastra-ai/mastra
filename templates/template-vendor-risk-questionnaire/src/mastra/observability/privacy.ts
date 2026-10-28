import { MastraLogger } from '@mastra/core/logger';
import type {
  AnySpan,
  AnyExportedSpan,
  ObservabilityExporter,
  SpanOutputProcessor,
  InitExporterOptions,
  TracingEvent,
  MetricEvent,
  LogEvent,
  ScoreEvent,
  FeedbackEvent,
} from '@mastra/core/observability';
import { Observability, MastraStorageExporter } from '@mastra/observability';
import { defaultExecutionPolicy } from '../contracts/execution-policy.ts';
import { sha256 } from '../intake/source.ts';
import { telemetryHealth, TelemetryHealth } from '../persistence/database.ts';

// Hash identifiers even when their schemas admit text. A syntactically valid ID can contain a secret.
export const telemetryId = (value: unknown) => (typeof value === 'string' ? sha256(value).slice(0, 24) : undefined);
function safeMetadata(raw: Record<string, unknown> = {}) {
  const safe: Record<string, string | number | boolean> = {};
  for (const key of ['runId', 'questionId', 'workflowRunId', 'organizationId']) {
    const value = telemetryId(raw[key]);
    if (value) safe[key] = value;
  }
  for (const key of [
    'attempt',
    'policyVersion',
    'inputTokens',
    'outputTokens',
    'reasoningTokens',
    'durationMs',
    'estimatedUsd',
  ]) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) safe[key] = value;
  }
  return safe;
}
function safeAttributes(value: object = {}) {
  const raw = value as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  if (raw.model === defaultExecutionPolicy.model.slice('openai/'.length)) safe.model = raw.model;
  if (raw.provider === 'openai') safe.provider = raw.provider;
  if (typeof raw.usageIncomplete === 'boolean') safe.usageIncomplete = raw.usageIncomplete;
  if (raw.usage && typeof raw.usage === 'object') {
    const usage = raw.usage as Record<string, unknown>;
    const clean: Record<string, number> = {};
    for (const key of ['inputTokens', 'outputTokens'])
      if (typeof usage[key] === 'number' && Number.isSafeInteger(usage[key]) && usage[key] >= 0)
        clean[key] = usage[key];
    if (Object.keys(clean).length) safe.usage = clean;
  }
  return safe;
}
function allowlistedSpan(span: AnyExportedSpan): AnyExportedSpan {
  return {
    id: sha256(span.id).slice(0, 16),
    traceId: sha256(span.traceId).slice(0, 32),
    parentSpanId: span.parentSpanId ? sha256(span.parentSpanId).slice(0, 16) : undefined,
    name: span.type,
    type: span.type,
    startTime: span.startTime,
    endTime: span.endTime,
    isEvent: span.isEvent,
    isRootSpan: span.isRootSpan,
    isInternal: span.isInternal,
    metadata: span.metadata,
    attributes: safeAttributes(span.attributes),
  };
}
class MetadataOnlyProcessor implements SpanOutputProcessor {
  name = 'vrq-metadata-only';
  private wrapped = new WeakSet<AnySpan>();
  private sanitized = new WeakMap<AnySpan, Record<string, string | number | boolean>>();
  private entityIds = new WeakMap<AnySpan, string>();
  process(span?: AnySpan) {
    if (!span) return undefined;
    const failed = Boolean(span.errorInfo);
    span.name = span.type;
    if (span.entityId !== this.entityIds.get(span)) {
      span.entityId = telemetryId(span.entityId);
      if (span.entityId === undefined) this.entityIds.delete(span);
      else this.entityIds.set(span, span.entityId);
    }
    span.entityName = undefined;
    span.input = undefined;
    span.output = undefined;
    span.requestContext = undefined;
    span.errorInfo = undefined;
    span.tags = undefined;
    const previous = this.sanitized.get(span);
    const metadata = safeMetadata(span.metadata);
    for (const key of ['runId', 'questionId', 'workflowRunId', 'organizationId']) {
      if (previous?.[key] && span.metadata?.[key] === previous[key]) metadata[key] = previous[key];
    }
    span.metadata = { ...metadata, failed: failed || previous?.failed === true };
    this.sanitized.set(span, span.metadata);
    if (!this.wrapped.has(span)) {
      const original = span.exportSpan.bind(span);
      span.exportSpan = includeInternal => {
        const exported = original(includeInternal);
        return exported ? allowlistedSpan(exported) : undefined;
      };
      this.wrapped.add(span);
    }
    // Native attributes contain prompts, tools, provider metadata and free-form errors.
    span.attributes = safeAttributes(span.attributes);
    return span;
  }
  async shutdown() {}
}
export class SafeLogger extends MastraLogger {
  private sink: (record: { level: string; code: string }) => void;
  constructor(
    sink: (record: { level: string; code: string }) => void = record => console.error(JSON.stringify(record)),
  ) {
    super({ name: 'vrq', level: 'warn' });
    this.sink = sink;
  }
  debug(_message: string, ..._args: unknown[]) {}
  info(_message: string, ..._args: unknown[]) {}
  warn(_message: string, ..._args: unknown[]) {
    this.sink({ level: 'warn', code: 'MASTRA_WARNING' });
  }
  error(_message: string, ..._args: unknown[]) {
    this.sink({ level: 'error', code: 'MASTRA_ERROR' });
  }
  override trackException(_error: Error, _metadata?: Record<string, unknown>) {
    this.sink({ level: 'error', code: 'OPERATION_FAILED' });
  }
}
class HealthExporter implements ObservabilityExporter {
  readonly name: string;
  private readonly exporter: ObservabilityExporter;
  private readonly health: TelemetryHealth;
  constructor(exporter: ObservabilityExporter, health: TelemetryHealth) {
    this.name = exporter.name;
    this.exporter = exporter;
    this.health = health;
  }
  private async observe(operation: () => unknown) {
    try {
      await operation();
    } catch {
      this.health.degrade();
      console.error(JSON.stringify({ level: 'warn', code: 'TELEMETRY_DEGRADED_INCOMPLETE' }));
    }
  }
  __setLogger(logger: Parameters<NonNullable<ObservabilityExporter['__setLogger']>>[0]) {
    this.exporter.__setLogger?.(logger);
  }
  init(options: InitExporterOptions) {
    return this.observe(() =>
      this.exporter.init?.({
        ...options,
        emitDropEvent: event => {
          this.health.degrade();
          options.emitDropEvent?.(event);
        },
      }),
    );
  }
  exportTracingEvent(event: TracingEvent) {
    return this.observe(() => this.exporter.exportTracingEvent(event));
  }
  onTracingEvent(event: TracingEvent) {
    return this.observe(() =>
      this.exporter.onTracingEvent ? this.exporter.onTracingEvent(event) : this.exporter.exportTracingEvent(event),
    );
  }
  onMetricEvent(event: MetricEvent) {
    return this.observe(() => this.exporter.onMetricEvent?.(event));
  }
  onLogEvent(event: LogEvent) {
    return this.observe(() => this.exporter.onLogEvent?.(event));
  }
  onScoreEvent(event: ScoreEvent) {
    return this.observe(() => this.exporter.onScoreEvent?.(event));
  }
  onFeedbackEvent(event: FeedbackEvent) {
    return this.observe(() => this.exporter.onFeedbackEvent?.(event));
  }
  flush() {
    return this.observe(() => this.exporter.flush());
  }
  shutdown() {
    return this.observe(() => this.exporter.shutdown());
  }
}
export function createLocalObservability(extraExporters: ObservabilityExporter[] = [], health = telemetryHealth) {
  return new Observability({
    configs: {
      local: {
        serviceName: 'vendor-risk-questionnaire',
        exporters: [new MastraStorageExporter({ logger: new SafeLogger() }), ...extraExporters].map(
          exporter => new HealthExporter(exporter, health),
        ),
        spanOutputProcessors: [new MetadataOnlyProcessor()],
        requestContextKeys: ['runId', 'questionId', 'organizationId', 'policyVersion'],
        // Native dual-write logger bypasses IMastraLogger sanitation; only our safe logger writes logs.
        logging: { enabled: false },
      },
    },
  });
}
