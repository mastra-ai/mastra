# PR 1.2: @mastra/observability Changes

**Package:** `observability/mastra`
**Scope:** Event bus implementations, base exporter updates

---

## 1.2.1 Base ObservabilityEventBus Implementation

**File:** `observability/mastra/src/bus/base.ts` (new)

```typescript
import { ObservabilityEventBus } from '@mastra/core';

export class BaseObservabilityEventBus<TEvent> implements ObservabilityEventBus<TEvent> {
  private subscribers: Set<(event: TEvent) => void> = new Set();
  private buffer: TEvent[] = [];
  private bufferSize: number;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(options: { bufferSize?: number; flushIntervalMs?: number } = {}) {
    this.bufferSize = options.bufferSize ?? 100;
    if (options.flushIntervalMs) {
      this.flushInterval = setInterval(() => this.flush(), options.flushIntervalMs);
    }
  }

  emit(event: TEvent): void {
    this.buffer.push(event);
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  subscribe(handler: (event: TEvent) => void): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  async flush(): Promise<void> {
    const events = this.buffer.splice(0);
    await Promise.all(
      events.flatMap(event =>
        Array.from(this.subscribers).map(handler =>
          Promise.resolve(handler(event)).catch(err =>
            console.error('[ObservabilityEventBus] Handler error:', err)
          )
        )
      )
    );
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
    this.subscribers.clear();
  }
}
```

**Tasks:**
- [ ] Implement BaseObservabilityEventBus
- [ ] Add buffering support
- [ ] Add flush interval option
- [ ] Handle errors gracefully

---

## 1.2.2 ObservabilityBus Implementation

**File:** `observability/mastra/src/bus/observability.ts` (new)

The main event bus for all observability signals. Routes events to appropriate exporter handlers based on event type.

```typescript
import {
  TracingEvent, TracingEventType, MetricEvent, LogEvent, ScoreEvent, FeedbackEvent,
  ObservabilityExporter
} from '@mastra/core';
import { BaseObservabilityEventBus } from './base';

// Union of all observability events
export type ObservabilityEvent =
  | TracingEvent
  | MetricEvent
  | LogEvent
  | ScoreEvent
  | FeedbackEvent;

export class ObservabilityBus extends BaseObservabilityEventBus<ObservabilityEvent> {
  private exporters: ObservabilityExporter[] = [];

  registerExporter(exporter: ObservabilityExporter): void {
    this.exporters.push(exporter);
  }

  emit(event: ObservabilityEvent): void {
    // Route to appropriate handler based on event type
    for (const exporter of this.exporters) {
      this.routeToHandler(exporter, event);
    }

    // Also buffer for batch processing if needed
    super.emit(event);
  }

  private routeToHandler(exporter: ObservabilityExporter, event: ObservabilityEvent): void {
    switch (event.type) {
      // TracingEvent uses TracingEventType enum (snake_case values)
      case TracingEventType.SPAN_STARTED:
      case TracingEventType.SPAN_UPDATED:
      case TracingEventType.SPAN_ENDED:
        exporter.onTracingEvent?.(event);
        break;
      case 'metric':
        exporter.onMetricEvent?.(event);
        break;
      case 'log':
        exporter.onLogEvent?.(event);
        break;
      case 'score':
        exporter.onScoreEvent?.(event);
        break;
      case 'feedback':
        exporter.onFeedbackEvent?.(event);
        break;
    }
  }
}
```

**Tasks:**
- [ ] Create ObservabilityBus with type-based routing
- [ ] Add exporter registration
- [ ] Route events to appropriate handlers
- [ ] Handle all event types from the start (handlers are no-ops until implemented)

---

## 1.2.3 Update BaseExporter

**File:** `observability/mastra/src/exporters/base.ts` (modify)

```typescript
export abstract class BaseExporter implements ObservabilityExporter {
  // Default handler that delegates to existing method for backward compat
  onTracingEvent(event: TracingEvent): void | Promise<void> {
    return this.exportTracingEvent(event);
  }

  // Subclasses implement handlers for the signals they support
  // No onMetricEvent = doesn't support metrics
  // No onLogEvent = doesn't support logs
  // etc.

  // EXISTING methods remain unchanged
  // ...
}
```

**Tasks:**
- [ ] Add default onTracingEvent that calls existing method
- [ ] Document that handler presence = signal support

---

## 1.2.4 Update BaseObservabilityInstance

**File:** `observability/mastra/src/instances/base.ts` (modify)

Refactor to use ObservabilityBus:

```typescript
export class BaseObservabilityInstance {
  private observabilityBus: ObservabilityBus;

  constructor(config: ObservabilityConfig) {
    // Initialize single bus for all signals
    this.observabilityBus = new ObservabilityBus();

    // Register exporters (bus routes events to appropriate handlers)
    for (const exporter of config.exporters) {
      this.observabilityBus.registerExporter(exporter);
    }
  }

  // Emit any observability event (bus routes to appropriate handlers)
  protected emit(event: ObservabilityEvent): void {
    this.observabilityBus.emit(event);
  }

  async flush(): Promise<void> {
    await this.observabilityBus.flush();
  }

  async shutdown(): Promise<void> {
    await this.observabilityBus.shutdown();
  }
}
```

**Tasks:**
- [ ] Create ObservabilityBus in constructor
- [ ] Register exporters with bus
- [ ] Add emit method for all event types
- [ ] Add flush/shutdown delegation

---

## PR 1.2 Testing

**Tasks:**
- [ ] Test BaseObservabilityEventBus emit/subscribe/flush
- [ ] Test ObservabilityBus routing to exporters
- [ ] Test exporter receives only events for handlers it implements
- [ ] Test backward compat with existing exporters
