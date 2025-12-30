/**
 * Test trace generator for observability exporter testing.
 * Generates realistic trace data with configurable depth and breadth.
 */

import type { TracingEvent, AnyExportedSpan } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';

export interface GenerateTraceOptions {
  /** Number of levels deep (default: 3) */
  depth?: number;
  /** Number of children per span (default: 2) */
  breadth?: number;
  /** Include event spans (default: true) */
  includeEvents?: boolean;
  /** Custom trace ID (default: generated) */
  traceId?: string;
  /** Base timestamp (default: now) */
  baseTime?: Date;
  /** Time increment between spans in ms (default: 100) */
  timeIncrementMs?: number;
}

interface SpanInfo {
  id: string;
  parentId?: string;
  depth: number;
  isRoot: boolean;
  isEvent: boolean;
}

let spanCounter = 0;

function generateSpanId(): string {
  return `span-${++spanCounter}-${Date.now()}`;
}

function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create an exported span with the given properties.
 */
function createExportedSpan(args: {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  type: SpanType;
  isRootSpan: boolean;
  isEvent: boolean;
  startTime: Date;
  endTime?: Date;
  input?: unknown;
  output?: unknown;
}): AnyExportedSpan {
  return {
    id: args.id,
    traceId: args.traceId,
    parentSpanId: args.parentSpanId,
    name: args.name,
    type: args.type,
    isRootSpan: args.isRootSpan,
    isEvent: args.isEvent,
    startTime: args.startTime,
    endTime: args.endTime,
    input: args.input,
    output: args.output,
    tags: args.isRootSpan ? ['test-trace'] : undefined,
  };
}

/**
 * Create a tracing event for a span.
 */
function createTracingEvent(type: 'span_started' | 'span_updated' | 'span_ended', span: AnyExportedSpan): TracingEvent {
  return {
    type,
    exportedSpan: span,
  };
}

/**
 * Generate a tree structure of span info.
 */
function generateSpanTree(opts: GenerateTraceOptions): SpanInfo[] {
  const depth = opts.depth ?? 3;
  const breadth = opts.breadth ?? 2;
  const includeEvents = opts.includeEvents ?? true;

  const spans: SpanInfo[] = [];

  function addSpan(parentId: string | undefined, currentDepth: number, isEvent: boolean = false): string {
    const id = generateSpanId();
    spans.push({
      id,
      parentId,
      depth: currentDepth,
      isRoot: currentDepth === 0 && !isEvent,
      isEvent,
    });
    return id;
  }

  function buildTree(parentId: string | undefined, currentDepth: number): void {
    if (currentDepth >= depth) return;

    // Create spans at this level
    for (let i = 0; i < breadth; i++) {
      const spanId = addSpan(parentId, currentDepth);

      // Add events if enabled and not at root level
      if (includeEvents && currentDepth > 0) {
        addSpan(spanId, currentDepth, true);
      }

      // Recurse to create children
      buildTree(spanId, currentDepth + 1);
    }
  }

  // Create root span
  const rootId = addSpan(undefined, 0);

  // Build tree from root
  buildTree(rootId, 1);

  return spans;
}

/**
 * Generate a complete trace with all events (start, update, end).
 * Returns events in the natural order they would occur.
 */
export function generateTrace(opts: GenerateTraceOptions = {}): TracingEvent[] {
  const traceId = opts.traceId ?? generateTraceId();
  const baseTime = opts.baseTime ?? new Date();
  const timeIncrement = opts.timeIncrementMs ?? 100;

  const spanTree = generateSpanTree(opts);
  const events: TracingEvent[] = [];
  let currentTime = baseTime.getTime();

  // Generate start events (in tree order - parents before children)
  for (const spanInfo of spanTree) {
    const startTime = new Date(currentTime);
    currentTime += timeIncrement;

    const span = createExportedSpan({
      id: spanInfo.id,
      traceId,
      parentSpanId: spanInfo.parentId,
      name: spanInfo.isEvent ? `event-${spanInfo.id}` : `span-${spanInfo.id}`,
      type: spanInfo.isEvent ? SpanType.EVENT : spanInfo.isRoot ? SpanType.AGENT_RUN : SpanType.TOOL_CALL,
      isRootSpan: spanInfo.isRoot,
      isEvent: spanInfo.isEvent,
      startTime,
      input: { test: 'input' },
    });

    if (spanInfo.isEvent) {
      // Events are single-shot
      events.push(createTracingEvent('span_ended', { ...span, endTime: startTime }));
    } else {
      events.push(createTracingEvent('span_started', span));
    }
  }

  // Generate end events (in reverse tree order - children before parents)
  const nonEventSpans = spanTree.filter(s => !s.isEvent);
  for (let i = nonEventSpans.length - 1; i >= 0; i--) {
    const spanInfo = nonEventSpans[i];
    const endTime = new Date(currentTime);
    currentTime += timeIncrement;

    const span = createExportedSpan({
      id: spanInfo.id,
      traceId,
      parentSpanId: spanInfo.parentId,
      name: `span-${spanInfo.id}`,
      type: spanInfo.isRoot ? SpanType.AGENT_RUN : SpanType.TOOL_CALL,
      isRootSpan: spanInfo.isRoot,
      isEvent: false,
      startTime: new Date(baseTime.getTime()), // Approximate
      endTime,
      output: { test: 'output' },
    });

    events.push(createTracingEvent('span_ended', span));
  }

  return events;
}

/**
 * Shuffle events to simulate out-of-order arrival.
 * Preserves that span_started comes before span_ended for same span.
 */
export function shuffleEvents(events: TracingEvent[]): TracingEvent[] {
  // Separate start and end events
  const startEvents = events.filter(e => e.type === 'span_started');
  const endEvents = events.filter(e => e.type === 'span_ended' && !e.exportedSpan.isEvent);
  const eventSpans = events.filter(e => e.exportedSpan.isEvent);

  // Shuffle each group
  const shuffled = (arr: TracingEvent[]) => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  // Combine shuffled groups: some starts, some events, some ends, interleaved
  const shuffledStarts = shuffled(startEvents);
  const shuffledEnds = shuffled(endEvents);
  const shuffledEvents = shuffled(eventSpans);

  // Interleave in a way that still mostly makes sense
  // (starts generally before ends, but not strictly)
  const result: TracingEvent[] = [];
  let startIdx = 0,
    endIdx = 0,
    eventIdx = 0;

  while (startIdx < shuffledStarts.length || endIdx < shuffledEnds.length || eventIdx < shuffledEvents.length) {
    const r = Math.random();
    if (r < 0.5 && startIdx < shuffledStarts.length) {
      result.push(shuffledStarts[startIdx++]);
    } else if (r < 0.8 && eventIdx < shuffledEvents.length) {
      result.push(shuffledEvents[eventIdx++]);
    } else if (endIdx < shuffledEnds.length) {
      result.push(shuffledEnds[endIdx++]);
    } else if (startIdx < shuffledStarts.length) {
      result.push(shuffledStarts[startIdx++]);
    } else if (eventIdx < shuffledEvents.length) {
      result.push(shuffledEvents[eventIdx++]);
    }
  }

  return result;
}

/**
 * Reorder events so children come before parents (worst case for early queue).
 */
export function reverseHierarchyOrder(events: TracingEvent[]): TracingEvent[] {
  const startEvents = events.filter(e => e.type === 'span_started');
  const endEvents = events.filter(e => e.type === 'span_ended' && !e.exportedSpan.isEvent);
  const eventSpans = events.filter(e => e.exportedSpan.isEvent);

  // Reverse start events so children come first
  const reversedStarts = [...startEvents].reverse();
  // Keep end events in original order (children end before parents)
  // Reverse event spans too
  const reversedEvents = [...eventSpans].reverse();

  return [...reversedStarts, ...reversedEvents, ...endEvents];
}

/**
 * Send events to an exporter with configurable delays.
 */
export async function sendWithDelays(
  exporter: { exportTracingEvent: (event: TracingEvent) => Promise<void> },
  events: TracingEvent[],
  delayMs: number = 0,
): Promise<void> {
  for (const event of events) {
    await exporter.exportTracingEvent(event);
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Wait for setImmediate callbacks to complete.
 */
export function flushSetImmediate(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Wait for multiple rounds of setImmediate (for cascading async processing).
 */
export async function flushSetImmediateMultiple(rounds: number = 5): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await flushSetImmediate();
  }
}
