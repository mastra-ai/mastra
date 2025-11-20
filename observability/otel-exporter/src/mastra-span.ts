/**
 * Custom OpenTelemetry span that preserves Mastra's trace and span IDs
 */

import type { AnyExportedSpan } from '@mastra/core/observability';
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
  readonly parentSpanContext?: SpanContext;
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
    span: AnyExportedSpan,
    attributes: Attributes,
    kind: SpanKind,
    parentSpanId?: string,
    resource?: Resource,
    instrumentationLibrary?: InstrumentationScope,
  ) {
    this.name = span.name;
    this.kind = kind;
    this.attributes = attributes;
    this.parentSpanId = parentSpanId;
    this.links = [];
    this.events = [];

    // Convert JavaScript Date to hrtime format [seconds, nanoseconds]
    this.startTime = this.dateToHrTime(span.startTime);
    this.endTime = span.endTime ? this.dateToHrTime(span.endTime) : this.startTime;
    this.ended = !!span.endTime;

    // Calculate duration
    if (span.endTime) {
      const durationMs = span.endTime.getTime() - span.startTime.getTime();
      this.duration = [Math.floor(durationMs / 1000), (durationMs % 1000) * 1000000];
    } else {
      this.duration = [0, 0];
    }

    // Set status based on error info
    if (span.errorInfo) {
      this.status = {
        code: SpanStatusCode.ERROR,
        message: span.errorInfo.message,
      };

      // Add error as event
      this.events.push({
        name: 'exception',
        attributes: {
          'exception.message': span.errorInfo.message,
          'exception.type': 'Error',
          ...(span.errorInfo.details?.stack && {
            'exception.stacktrace': span.errorInfo.details.stack as string,
          }),
        },
        time: this.startTime,
        droppedAttributesCount: 0,
      });
    } else if (span.endTime) {
      this.status = { code: SpanStatusCode.OK };
    } else {
      this.status = { code: SpanStatusCode.UNSET };
    }

    // Add instant event if needed
    if (span.isEvent) {
      this.events.push({
        name: 'instant_event',
        attributes: {},
        time: this.startTime,
        droppedAttributesCount: 0,
      });
    }

    // Create span context with Mastra's IDs
    this.spanContext = () => ({
      traceId: span.traceId,
      spanId: span.id,
      traceFlags: TraceFlags.SAMPLED,
      isRemote: false,
    });

    // Set parent span context if parent span ID is provided
    if (parentSpanId) {
      this.parentSpanContext = {
        traceId: span.traceId,
        spanId: parentSpanId,
        traceFlags: TraceFlags.SAMPLED,
        isRemote: false,
      };
    }

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
