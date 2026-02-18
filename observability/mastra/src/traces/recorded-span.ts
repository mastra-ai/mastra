/**
 * RecordedSpanImpl - A span loaded from storage with tree structure and
 * annotation capabilities (addScore, addFeedback).
 *
 * Implements RecordedSpan<TType> from @mastra/core. The core span data
 * is immutable (from an ExportedSpan), but annotation methods emit events
 * for persistence via the ObservabilityBus.
 */

import type {
  RecordedSpan,
  AnyRecordedSpan,
  AnyExportedSpan,
  SpanType,
  SpanTypeMap,
  EntityType,
  SpanErrorInfo,
  ScoreInput,
  FeedbackInput,
  ExportedScore,
  ExportedFeedback,
  ScoreEvent,
  FeedbackEvent,
} from '@mastra/core/observability';

import type { ObservabilityBus } from '../bus';

export class RecordedSpanImpl<TType extends SpanType = SpanType> implements RecordedSpan<TType> {
  // Tree structure - wired up after construction by buildRecordedTrace
  private _parent?: AnyRecordedSpan;
  private _children: AnyRecordedSpan[] = [];

  constructor(
    private record: AnyExportedSpan,
    private bus: ObservabilityBus,
  ) {}

  // SpanData properties (from record)
  get id(): string {
    return this.record.id;
  }
  get traceId(): string {
    return this.record.traceId;
  }
  get name(): string {
    return this.record.name;
  }
  get type(): TType {
    return this.record.type as TType;
  }
  get startTime(): Date {
    return this.record.startTime;
  }
  get endTime(): Date | undefined {
    return this.record.endTime;
  }
  get parentSpanId(): string | undefined {
    return this.record.parentSpanId;
  }
  get isRootSpan(): boolean {
    return this.record.isRootSpan;
  }
  get metadata(): Record<string, unknown> | undefined {
    return this.record.metadata;
  }
  get attributes(): SpanTypeMap[TType] | undefined {
    return this.record.attributes as SpanTypeMap[TType] | undefined;
  }
  get input(): unknown {
    return this.record.input;
  }
  get output(): unknown {
    return this.record.output;
  }
  get errorInfo(): SpanErrorInfo | undefined {
    return this.record.errorInfo;
  }
  get tags(): string[] | undefined {
    return this.record.tags;
  }
  get isEvent(): boolean {
    return this.record.isEvent;
  }
  get entityType(): EntityType | undefined {
    return this.record.entityType;
  }
  get entityId(): string | undefined {
    return this.record.entityId;
  }
  get entityName(): string | undefined {
    return this.record.entityName;
  }

  // Tree structure
  get parent(): AnyRecordedSpan | undefined {
    return this._parent;
  }
  get children(): ReadonlyArray<AnyRecordedSpan> {
    return this._children;
  }

  // Internal methods for wiring up tree (called by buildRecordedTrace)
  _setParent(parent: AnyRecordedSpan): void {
    this._parent = parent;
  }
  _addChild(child: AnyRecordedSpan): void {
    this._children.push(child);
  }

  addScore(score: ScoreInput): void {
    const exportedScore: ExportedScore = {
      timestamp: new Date(),
      traceId: this.traceId,
      spanId: this.id,
      scorerName: score.scorerName,
      score: score.score,
      reason: score.reason,
      experimentId: score.experimentId,
      metadata: {
        ...this.record.metadata,
        ...score.metadata,
      },
    };

    const event: ScoreEvent = { type: 'score', score: exportedScore };
    this.bus.emit(event);
  }

  addFeedback(feedback: FeedbackInput): void {
    const exportedFeedback: ExportedFeedback = {
      timestamp: new Date(),
      traceId: this.traceId,
      spanId: this.id,
      source: feedback.source,
      feedbackType: feedback.feedbackType,
      value: feedback.value,
      comment: feedback.comment,
      experimentId: feedback.experimentId,
      metadata: {
        ...this.record.metadata,
        userId: feedback.userId,
        ...feedback.metadata,
      },
    };

    const event: FeedbackEvent = { type: 'feedback', feedback: exportedFeedback };
    this.bus.emit(event);
  }
}
