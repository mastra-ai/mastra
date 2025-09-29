/**
 * Custom OpenTelemetry span that preserves Mastra's trace and span IDs
 */

import type { AnyExportedAISpan } from '@mastra/core/ai-tracing';
import { SpanStatusCode, TraceFlags } from '@opentelemetry/api';
import type { SpanKind, SpanContext, SpanStatus, Attributes, Link } from '@opentelemetry/api';
import type { InstrumentationScope } from '@opentelemetry/core';
import type { Resource } from '@opentelemetry/resources';
import type { ReadableSpan, TimedEvent } from '@opentelemetry/sdk-trace-base';

/**
 * A custom ReadableSpan implementation that preserves Mastra's IDs
 */
export class MastraReadableSpan implements ReadableSpan {
  readonly name: string;
  readonly kind: SpanKind;
  readonly spanContext: () => SpanContext;
  readonly parentSpanId?: string;
  readonly startTime: [number, number];
  readonly endTime: [number, number];
  readonly status: SpanStatus;
  readonly attributes: Attributes;
  readonly links: Link[];
  readonly events: TimedEvent[];
  readonly duration: [number, number];
  readonly ended: boolean;
  readonly resource: Resource;
  readonly instrumentationLibrary: InstrumentationScope;
  readonly instrumentationScope: InstrumentationScope;
  readonly droppedAttributesCount: number = 0;
  readonly droppedEventsCount: number = 0;
  readonly droppedLinksCount: number = 0;

  constructor(
    aiSpan: AnyExportedAISpan,
    attributes: Attributes,
    kind: SpanKind,
    parentSpanId?: string,
    resource?: Resource,
    instrumentationLibrary?: InstrumentationScope,
  ) {
    this.name = aiSpan.name;
    this.kind = kind;
    this.attributes = attributes;
    this.parentSpanId = parentSpanId;
    this.links = [];
    this.events = [];

    // Convert JavaScript Date to hrtime format [seconds, nanoseconds]
    this.startTime = this.dateToHrTime(aiSpan.startTime);
    this.endTime = aiSpan.endTime ? this.dateToHrTime(aiSpan.endTime) : this.startTime;
    this.ended = !!aiSpan.endTime;

    // Calculate duration
    if (aiSpan.endTime) {
      const durationMs = aiSpan.endTime.getTime() - aiSpan.startTime.getTime();
      this.duration = [Math.floor(durationMs / 1000), (durationMs % 1000) * 1000000];
    } else {
      this.duration = [0, 0];
    }

    // Set status based on error info
    if (aiSpan.errorInfo) {
      this.status = {
        code: SpanStatusCode.ERROR,
        message: aiSpan.errorInfo.message,
      };

      // Add error as event
      this.events.push({
        name: 'exception',
        attributes: {
          'exception.message': aiSpan.errorInfo.message,
          'exception.type': 'Error',
          ...(aiSpan.errorInfo.details?.stack && {
            'exception.stacktrace': aiSpan.errorInfo.details.stack as string,
          }),
        },
        time: this.startTime,
        droppedAttributesCount: 0,
      });
    } else if (aiSpan.endTime) {
      this.status = { code: SpanStatusCode.OK };
    } else {
      this.status = { code: SpanStatusCode.UNSET };
    }

    // Add instant event if needed
    if (aiSpan.isEvent) {
      this.events.push({
        name: 'instant_event',
        attributes: {},
        time: this.startTime,
        droppedAttributesCount: 0,
      });
    }

    // Create span context with Mastra's IDs
    this.spanContext = () => ({
      traceId: aiSpan.traceId,
      spanId: aiSpan.id,
      traceFlags: TraceFlags.SAMPLED,
      isRemote: false,
    });

    // Set resource and instrumentation library
    this.resource = resource || ({} as Resource);
    this.instrumentationLibrary = instrumentationLibrary || {
      name: '@mastra/otel',
      version: '1.0.0',
    };
    // instrumentationScope is the same as instrumentationLibrary
    this.instrumentationScope = this.instrumentationLibrary;
  }

  /**
   * Convert JavaScript Date to hrtime format
   */
  private dateToHrTime(date: Date): [number, number] {
    const ms = date.getTime();
    const seconds = Math.floor(ms / 1000);
    const nanoseconds = (ms % 1000) * 1000000;
    return [seconds, nanoseconds];
  }
}
