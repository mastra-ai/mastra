import { generateSignalId } from '@mastra/core/observability';
import type {
  AnyRecordedSpan,
  CorrelationContext,
  FeedbackEvent,
  FeedbackInput,
  RecordedSpan,
  RecordedTrace,
  ScoreEvent,
  ScoreInput,
  SpanType,
  SpanTypeMap,
} from '@mastra/core/observability';
import type { GetTraceResponse, SpanRecord } from '@mastra/core/storage';

type RecordedAnnotationEvent = ScoreEvent | FeedbackEvent;
type EmitRecordedEvent = (event: RecordedAnnotationEvent) => void | Promise<void>;
type CanEmitRecordedEvent = () => boolean;
type DebugRecordedAnnotationUnavailable = (args: {
  kind: 'score' | 'feedback';
  traceId: string;
  spanId?: string;
}) => void;
type RecordedErrorInfo = AnyRecordedSpan['errorInfo'];
type CorrelationParent = Pick<SpanRecord, 'entityType' | 'entityId' | 'entityName'> | AnyRecordedSpan | undefined;

function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

function mergeMetadata(
  base: Record<string, any> | null | undefined,
  extra: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!base && !extra) return undefined;
  return {
    ...(base ?? {}),
    ...(extra ?? {}),
  };
}

function normalizeErrorInfo(error: SpanRecord['error']): RecordedErrorInfo {
  if (!error || typeof error !== 'object' || !('message' in error) || typeof error.message !== 'string') {
    return undefined;
  }

  return {
    message: error.message,
    id: 'id' in error && typeof error.id === 'string' ? error.id : undefined,
    name: 'name' in error && typeof error.name === 'string' ? error.name : undefined,
    stack: 'stack' in error && typeof error.stack === 'string' ? error.stack : undefined,
    domain: 'domain' in error && typeof error.domain === 'string' ? error.domain : undefined,
    category: 'category' in error && typeof error.category === 'string' ? error.category : undefined,
    details:
      'details' in error && error.details && typeof error.details === 'object'
        ? (error.details as Record<string, any>)
        : undefined,
  };
}

function buildCorrelationContext(
  span: SpanRecord,
  rootSpan: SpanRecord,
  parent?: CorrelationParent,
): CorrelationContext {
  return {
    tags: rootSpan.tags ?? undefined,
    entityType: nullToUndefined(span.entityType),
    entityId: nullToUndefined(span.entityId),
    entityName: nullToUndefined(span.entityName),
    parentEntityType: parent?.entityType ?? undefined,
    parentEntityId: parent?.entityId ?? undefined,
    parentEntityName: parent?.entityName ?? undefined,
    rootEntityType: nullToUndefined(rootSpan.entityType),
    rootEntityId: nullToUndefined(rootSpan.entityId),
    rootEntityName: nullToUndefined(rootSpan.entityName),
    userId: nullToUndefined(span.userId),
    organizationId: nullToUndefined(span.organizationId),
    resourceId: nullToUndefined(span.resourceId),
    runId: nullToUndefined(span.runId),
    sessionId: nullToUndefined(span.sessionId),
    threadId: nullToUndefined(span.threadId),
    requestId: nullToUndefined(span.requestId),
    environment: nullToUndefined(span.environment),
    source: nullToUndefined(span.source),
    serviceName: nullToUndefined(span.serviceName),
    experimentId: nullToUndefined(span.experimentId),
  };
}

export function buildScoreEvent(args: {
  traceId?: string;
  spanId?: string;
  correlationContext?: CorrelationContext;
  score: ScoreInput;
  inheritedMetadata?: Record<string, any> | null;
}): ScoreEvent {
  const { traceId, spanId, correlationContext, score, inheritedMetadata } = args;

  return {
    type: 'score',
    score: {
      scoreId: generateSignalId(),
      timestamp: new Date(),
      traceId,
      spanId,
      scorerId: score.scorerId,
      scorerVersion: score.scorerVersion,
      source: score.source,
      scoreSource: score.scoreSource,
      score: score.score,
      reason: score.reason,
      experimentId: score.experimentId,
      scoreTraceId: score.scoreTraceId,
      correlationContext,
      metadata: mergeMetadata(inheritedMetadata, score.metadata),
    },
  };
}

export function buildFeedbackEvent(args: {
  traceId?: string;
  spanId?: string;
  correlationContext?: CorrelationContext;
  feedback: FeedbackInput;
  inheritedMetadata?: Record<string, any> | null;
}): FeedbackEvent {
  const { traceId, spanId, correlationContext, feedback, inheritedMetadata } = args;

  return {
    type: 'feedback',
    feedback: {
      feedbackId: generateSignalId(),
      timestamp: new Date(),
      traceId,
      spanId,
      source: feedback.source,
      feedbackSource: feedback.feedbackSource,
      feedbackType: feedback.feedbackType,
      value: feedback.value,
      userId: feedback.userId,
      feedbackUserId: feedback.feedbackUserId,
      comment: feedback.comment,
      sourceId: feedback.sourceId,
      experimentId: feedback.experimentId,
      correlationContext,
      metadata: mergeMetadata(inheritedMetadata, feedback.metadata),
    },
  };
}

function findSpanById(spans: SpanRecord[], spanId: string | undefined): SpanRecord | undefined {
  if (!spanId) return undefined;
  return spans.find(span => span.spanId === spanId);
}

export function buildRecordedScoreEventFromTrace(args: {
  trace: GetTraceResponse;
  score: ScoreInput;
  spanId?: string;
}): ScoreEvent | null {
  const rootSpan = findRootSpan(args.trace.spans);
  if (!rootSpan) return null;

  const span = args.spanId ? findSpanById(args.trace.spans, args.spanId) : rootSpan;
  if (!span) return null;

  const parent = span.parentSpanId ? findSpanById(args.trace.spans, span.parentSpanId) : undefined;

  return buildScoreEvent({
    traceId: span.traceId,
    spanId: args.spanId,
    correlationContext: buildCorrelationContext(span, rootSpan, parent),
    score: args.score,
    inheritedMetadata: span.metadata,
  });
}

export function buildRecordedFeedbackEventFromTrace(args: {
  trace: GetTraceResponse;
  feedback: FeedbackInput;
  spanId?: string;
}): FeedbackEvent | null {
  const rootSpan = findRootSpan(args.trace.spans);
  if (!rootSpan) return null;

  const span = args.spanId ? findSpanById(args.trace.spans, args.spanId) : rootSpan;
  if (!span) return null;

  const parent = span.parentSpanId ? findSpanById(args.trace.spans, span.parentSpanId) : undefined;

  return buildFeedbackEvent({
    traceId: span.traceId,
    spanId: args.spanId,
    correlationContext: buildCorrelationContext(span, rootSpan, parent),
    feedback: args.feedback,
    inheritedMetadata: span.metadata,
  });
}

class RecordedSpanImpl<TType extends SpanType = SpanType> implements RecordedSpan<TType> {
  public readonly id: string;
  public readonly traceId: string;
  public readonly name: string;
  public readonly type: TType;
  public readonly entityType?: RecordedSpan<TType>['entityType'];
  public readonly entityId?: string;
  public readonly entityName?: string;
  public readonly startTime: Date;
  public readonly endTime?: Date;
  public readonly attributes?: SpanTypeMap[TType];
  public readonly metadata?: Record<string, any>;
  public readonly tags?: string[];
  public readonly input?: any;
  public readonly output?: any;
  public readonly errorInfo?: {
    message: string;
    id?: string;
    name?: string;
    stack?: string;
    domain?: string;
    category?: string;
    details?: Record<string, any>;
  };
  public readonly requestContext?: Record<string, any>;
  public readonly isEvent: boolean;
  public readonly isRootSpan: boolean;
  public readonly parentSpanId?: string;
  public parent?: RecordedSpanImpl;
  public readonly children: RecordedSpanImpl[] = [];

  readonly #raw: SpanRecord;
  readonly #rootSpan: SpanRecord;
  readonly #emitRecordedEvent: EmitRecordedEvent;
  readonly #canEmitRecordedEvent: CanEmitRecordedEvent;
  readonly #debugRecordedAnnotationUnavailable: DebugRecordedAnnotationUnavailable;

  constructor(args: {
    raw: SpanRecord;
    rootSpan: SpanRecord;
    emitRecordedEvent: EmitRecordedEvent;
    canEmitRecordedEvent: CanEmitRecordedEvent;
    debugRecordedAnnotationUnavailable: DebugRecordedAnnotationUnavailable;
  }) {
    const { raw, rootSpan, emitRecordedEvent, canEmitRecordedEvent, debugRecordedAnnotationUnavailable } = args;

    this.#raw = raw;
    this.#rootSpan = rootSpan;
    this.#emitRecordedEvent = emitRecordedEvent;
    this.#canEmitRecordedEvent = canEmitRecordedEvent;
    this.#debugRecordedAnnotationUnavailable = debugRecordedAnnotationUnavailable;

    this.id = raw.spanId;
    this.traceId = raw.traceId;
    this.name = raw.name;
    this.type = raw.spanType as TType;
    this.entityType = raw.entityType ?? undefined;
    this.entityId = raw.entityId ?? undefined;
    this.entityName = raw.entityName ?? undefined;
    this.startTime = raw.startedAt;
    this.endTime = raw.endedAt ?? undefined;
    this.attributes = (raw.attributes ?? undefined) as SpanTypeMap[TType] | undefined;
    this.metadata = raw.metadata ?? undefined;
    this.tags = raw.tags ?? undefined;
    this.input = raw.input ?? undefined;
    this.output = raw.output ?? undefined;
    this.errorInfo = normalizeErrorInfo(raw.error);
    this.requestContext = raw.requestContext ?? undefined;
    this.isEvent = raw.isEvent;
    this.isRootSpan = !raw.parentSpanId;
    this.parentSpanId = raw.parentSpanId ?? undefined;
  }

  async addScore(score: ScoreInput): Promise<void> {
    if (!this.#canEmitRecordedEvent()) {
      this.#debugRecordedAnnotationUnavailable({ kind: 'score', traceId: this.traceId, spanId: this.id });
      return;
    }

    await this.#emitRecordedEvent(
      buildScoreEvent({
        traceId: this.#raw.traceId,
        spanId: this.id,
        correlationContext: buildCorrelationContext(this.#raw, this.#rootSpan, this.parent),
        score,
        inheritedMetadata: this.#raw.metadata,
      }),
    );
  }

  async addFeedback(feedback: FeedbackInput): Promise<void> {
    if (!this.#canEmitRecordedEvent()) {
      this.#debugRecordedAnnotationUnavailable({ kind: 'feedback', traceId: this.traceId, spanId: this.id });
      return;
    }

    await this.#emitRecordedEvent(
      buildFeedbackEvent({
        traceId: this.#raw.traceId,
        spanId: this.id,
        correlationContext: buildCorrelationContext(this.#raw, this.#rootSpan, this.parent),
        feedback,
        inheritedMetadata: this.#raw.metadata,
      }),
    );
  }
}

class RecordedTraceImpl implements RecordedTrace {
  public readonly traceId: string;
  public readonly rootSpan: AnyRecordedSpan;
  public readonly spans: ReadonlyArray<AnyRecordedSpan>;

  readonly #rootRecord: SpanRecord;
  readonly #emitRecordedEvent: EmitRecordedEvent;
  readonly #spanMap: Map<string, AnyRecordedSpan>;
  readonly #canEmitRecordedEvent: CanEmitRecordedEvent;
  readonly #debugRecordedAnnotationUnavailable: DebugRecordedAnnotationUnavailable;

  constructor(args: {
    traceId: string;
    rootSpan: AnyRecordedSpan;
    rootRecord: SpanRecord;
    spans: AnyRecordedSpan[];
    emitRecordedEvent: EmitRecordedEvent;
    canEmitRecordedEvent: CanEmitRecordedEvent;
    debugRecordedAnnotationUnavailable: DebugRecordedAnnotationUnavailable;
  }) {
    this.traceId = args.traceId;
    this.rootSpan = args.rootSpan;
    this.#rootRecord = args.rootRecord;
    this.spans = args.spans;
    this.#emitRecordedEvent = args.emitRecordedEvent;
    this.#spanMap = new Map(args.spans.map(span => [span.id, span]));
    this.#canEmitRecordedEvent = args.canEmitRecordedEvent;
    this.#debugRecordedAnnotationUnavailable = args.debugRecordedAnnotationUnavailable;
  }

  getSpan(spanId: string): AnyRecordedSpan | null {
    return this.#spanMap.get(spanId) ?? null;
  }

  async addScore(score: ScoreInput): Promise<void> {
    if (!this.#canEmitRecordedEvent()) {
      this.#debugRecordedAnnotationUnavailable({ kind: 'score', traceId: this.traceId });
      return;
    }

    await this.#emitRecordedEvent(
      buildScoreEvent({
        traceId: this.#rootRecord.traceId,
        correlationContext: buildCorrelationContext(this.#rootRecord, this.#rootRecord),
        score,
        inheritedMetadata: this.#rootRecord.metadata,
      }),
    );
  }

  async addFeedback(feedback: FeedbackInput): Promise<void> {
    if (!this.#canEmitRecordedEvent()) {
      this.#debugRecordedAnnotationUnavailable({ kind: 'feedback', traceId: this.traceId });
      return;
    }

    await this.#emitRecordedEvent(
      buildFeedbackEvent({
        traceId: this.#rootRecord.traceId,
        correlationContext: buildCorrelationContext(this.#rootRecord, this.#rootRecord),
        feedback,
        inheritedMetadata: this.#rootRecord.metadata,
      }),
    );
  }
}

function findRootSpan(spans: SpanRecord[]): SpanRecord | undefined {
  const spanIds = new Set(spans.map(span => span.spanId));
  return spans.find(span => !span.parentSpanId || !spanIds.has(span.parentSpanId)) ?? spans[0];
}

export function hydrateRecordedTrace(args: {
  trace: GetTraceResponse;
  emitRecordedEvent: EmitRecordedEvent;
  canEmitRecordedEvent?: CanEmitRecordedEvent;
  debugRecordedAnnotationUnavailable?: DebugRecordedAnnotationUnavailable;
}): RecordedTrace | null {
  const {
    trace,
    emitRecordedEvent,
    canEmitRecordedEvent = () => true,
    debugRecordedAnnotationUnavailable = () => {},
  } = args;
  const rootSpan = findRootSpan(trace.spans);

  if (!rootSpan) {
    return null;
  }

  const recordedSpans = trace.spans.map(
    raw =>
      new RecordedSpanImpl({
        raw,
        rootSpan,
        emitRecordedEvent,
        canEmitRecordedEvent,
        debugRecordedAnnotationUnavailable,
      }),
  );
  const spanMap = new Map(recordedSpans.map(span => [span.id, span]));

  for (const span of recordedSpans) {
    if (!span.parentSpanId) continue;
    const parent = spanMap.get(span.parentSpanId);
    if (!parent) continue;

    span.parent = parent;
    parent.children.push(span);
  }

  const hydratedRootSpan = spanMap.get(rootSpan.spanId);
  if (!hydratedRootSpan) {
    return null;
  }

  return new RecordedTraceImpl({
    traceId: trace.traceId,
    rootSpan: hydratedRootSpan,
    rootRecord: rootSpan,
    spans: recordedSpans,
    emitRecordedEvent,
    canEmitRecordedEvent,
    debugRecordedAnnotationUnavailable,
  });
}
