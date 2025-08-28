# AI Tracing Batch Processing Plan

## Overview

This document outlines the plan to enhance the `DefaultExporter` with intelligent batch processing capabilities for AI tracing spans. The goal is to provide production-ready performance while maintaining simplicity and database-specific optimizations.

Note: This plan was created on 27-Aug-25, but may now be out of date.

## Architecture

### Single Exporter Strategy

- Replace current `DefaultExporter` with enhanced version supporting multiple strategies
- Backward compatible - existing usage works unchanged (auto-selects optimal strategy)
- No migration needed, just enhanced functionality

## Configuration Design

```typescript
interface BatchingConfig {
  maxBatchSize: number; // Default: 1000 spans
  maxBufferSize: number; // Default: 10000 spans
  maxBatchWaitMs: number; // Default: 5000ms
  maxRetries?: number; // Default: 4
  retryDelayMs?: number; // Default: 500ms (base delay for exponential backoff)

  // Strategy selection (optional)
  strategy?: 'realtime' | 'batch-with-updates' | 'insert-only' | 'auto';
}

// Constructor: new DefaultExporter(mastra, config?, logger?)
```

## Intelligent Strategy Selection

### Storage Provider Hints

Extend the `MastraStorage` base class with strategy recommendations:

```typescript
// In MastraStorage base class
public get aiTracingStrategy(): {
  preferred: 'realtime' | 'batch-with-updates' | 'insert-only';
  supported: ('realtime' | 'batch-with-updates' | 'insert-only')[];
} {
  return {
    preferred: 'batch-with-updates',  // Default for most SQL stores
    supported: ['realtime', 'batch-with-updates', 'insert-only']
  };
}
```

### Storage-Specific Implementations

**ClickHouse Storage Adapter:**

```typescript
get aiTracingStrategy() {
  return {
    preferred: 'insert-only',
    supported: ['insert-only'] // NO realtime support - not suitable for ClickHouse
  };
}
```

**PostgreSQL Storage Adapter:**

```typescript
get aiTracingStrategy() {
  return {
    preferred: 'batch-with-updates',
    supported: ['realtime', 'batch-with-updates', 'insert-only']
  };
}
```

**In-Memory/Development Storage:**

```typescript
get aiTracingStrategy() {
  return {
    preferred: 'realtime',
    supported: ['realtime', 'batch-with-updates', 'insert-only']
  };
}
```

### Strategy Resolution Logic

1. **User explicitly set strategy** → validate against storage, use if supported
2. **User set 'auto' or no strategy** → use storage's preferred strategy
3. **Invalid user strategy** → log warning, fall back to storage preferred

## Strategy Behaviors

### 'realtime' Strategy

- Process each event immediately (current behavior)
- **NOT supported by ClickHouse** adapters (enforced by storage hints)
- Optimal for development and debugging
- Config: `{ maxBatchSize: 1, maxBatchWaitMs: 0, strategy: 'realtime' }`

### 'batch-with-updates' Strategy

- Buffer all event types until batch triggers
- Use `batchCreateAISpans` and `batchUpdateAISpans` from storage base class
- Full span lifecycle support: SPAN_STARTED → SPAN_UPDATED → SPAN_ENDED
- Optimal for PostgreSQL, SQLite, MySQL
- Default config: `{ maxBatchSize: 1000, maxBatchWaitMs: 5000, strategy: 'batch-with-updates' }`

### 'insert-only' Strategy

- **Only process SPAN_ENDED events** (ignore STARTED/UPDATED events)
- Use `batchCreateAISpans` only
- **~70% reduction in database operations**
- **No ordering requirements** - spans can be inserted in any order
- Perfect for ClickHouse, BigQuery, other append-only stores
- Default config: `{ maxBatchSize: 1000, maxBatchWaitMs: 5000, strategy: 'insert-only' }`

## Buffer Management

### Buffer Structure

```typescript
interface BatchBuffer {
  // For batch-with-updates strategy
  creates: AISpanRecord[];
  updates: UpdateRecord[];

  // For insert-only strategy
  insertOnly: AISpanRecord[];

  // Ordering enforcement (batch-with-updates only)
  seenSpans: Set<string>; // "traceId:spanId" combinations we've seen creates for
  spanSequences: Map<string, number>; // "traceId:spanId" -> next sequence number

  // Metrics
  outOfOrderCount: number;

  // Metadata
  firstEventTime?: Date;
  totalSize: number;
}

interface UpdateRecord {
  traceId: string;
  spanId: string;
  updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
  sequenceNumber: number; // For ordering updates to same span
}
```

### Flush Triggers (Priority Order)

1. **Emergency**: `totalSize >= maxBufferSize` → immediate flush
2. **Size**: `totalSize >= maxBatchSize` → normal flush
3. **Time**: `now - firstEventTime >= maxBatchWaitMs` → time-based flush
4. **Shutdown**: Force flush all pending events

### Timer Management

- Start timer on first event in empty buffer
- Cancel timer on flush
- Use `setTimeout` for simplicity and efficiency

## Span Ordering for Batch-With-Updates Strategy

### The Ordering Problem

**Issue 1: Create-Before-Update Ordering**

- `SPAN_STARTED` must reach database before `SPAN_UPDATED`/`SPAN_ENDED` for same span
- Batching could mix creates/updates for same span in wrong order

**Issue 2: Update Ordering**

- Multiple `SPAN_UPDATED` events for same span must be applied in chronological order
- Out-of-order updates could overwrite newer data with older data

### Solution: Sequence Numbers + Span Tracking

**Event Processing Logic:**

```typescript
private addToBuffer(event: AITracingEvent): void {
  const spanKey = `${event.span.traceId}:${event.span.id}`; // Unique span identifier

  switch (event.type) {
    case AITracingEventType.SPAN_STARTED:
      this.buffer.creates.push(this.buildCreateRecord(event.span));
      this.buffer.seenSpans.add(spanKey);
      break;

    case AITracingEventType.SPAN_UPDATED:
    case AITracingEventType.SPAN_ENDED:
      if (this.buffer.seenSpans.has(spanKey)) {
        // Normal case: create already in buffer
        this.buffer.updates.push({
          ...this.buildUpdateRecord(event.span),
          sequenceNumber: this.getNextSequence(spanKey)
        });
      } else {
        // Out-of-order case: log and skip for now
        this.handleOutOfOrderUpdate(event);
        this.buffer.outOfOrderCount++;
      }
      break;
  }
}
```

**Sequence Number Generation:**

```typescript
private getNextSequence(spanKey: string): number {
  const current = this.buffer.spanSequences.get(spanKey) || 0;
  const next = current + 1;
  this.buffer.spanSequences.set(spanKey, next);
  return next;
}
```

**Ordered Flush Processing:**

```typescript
private async flush(): Promise<void> {
  // 1. Process creates first (always safe)
  if (this.buffer.creates.length > 0) {
    await this.storage.batchCreateAISpans(this.buffer.creates);
  }

  // 2. Sort updates by span, then by sequence number
  const sortedUpdates = this.buffer.updates.sort((a, b) => {
    const spanCompare = `${a.traceId}:${a.spanId}`.localeCompare(`${b.traceId}:${b.spanId}`);
    if (spanCompare !== 0) return spanCompare;
    return a.sequenceNumber - b.sequenceNumber;
  });

  // 3. Process updates in order
  if (sortedUpdates.length > 0) {
    await this.storage.batchUpdateAISpans({ records: sortedUpdates });
  }
}
```

**Out-of-Order Handler:**

```typescript
private handleOutOfOrderUpdate(event: AITracingEvent): void {
  this.logger.warn('Out-of-order span update detected - skipping event', {
    spanId: event.span.id,
    traceId: event.span.traceId,
    eventType: event.type
  });

  // For now: just log and skip the event
  // TODO: In future, could implement immediate processing or buffering
}
```

### Benefits of This Approach

1. **Handles 99% of cases perfectly** - Normal span lifecycle is create → update → end
2. **Simple and predictable** - Clear ordering rules with sequence numbers
3. **Defensive against edge cases** - Graceful handling of out-of-order events
4. **Observable** - Metrics on out-of-order events for monitoring

### Insert-Only Strategy Ordering

For insert-only strategy (ClickHouse), **no special ordering is required**:

- Only processes `SPAN_ENDED` events
- Spans can be inserted in any order since they're final/immutable
- Simple: `await storage.batchCreateAISpans(this.buffer.insertOnly)`

## Error Handling Strategy

### Retry Logic with Exponential Backoff

- **Exponential backoff**: `retryDelayMs * (2 ^ attempt)`
- **Default timing**: 500ms, 1s, 2s, 4s
- **First retry at 0.5s**: Gives network hiccups time to resolve
- **4 attempts total**: Better resilience for transient issues
- No external dependencies - simple implementation

### Failure Modes

- **Transient errors**: Retry with exponential backoff
- **Buffer overflow**: Log warning, force flush oldest batch, continue
- **Persistent failures**: After `maxRetries`, log error and drop batch
- **NO circuit breaker**: Removed complexity, keeps behavior predictable

### Buffer Overflow Protection

- When approaching `maxBufferSize`: force flush oldest batches first
- If still overflowing: drop oldest events with warning
- Prevents unbounded memory growth during storage outages

## Memory and Performance Characteristics

### Memory Usage

- **Normal operation**: ~2-10MB (1000 spans × 2-10KB each)
- **Buffer full**: ~20-100MB (10000 spans)
- Very reasonable for production systems

### Performance Benefits

- **Batch strategies**: 10-100x throughput improvement vs realtime
- **Insert-only**: Additional 70% reduction in DB operations
- Better network efficiency (fewer round trips)
- Amortized serialization costs

## Database Optimization Strategies

### ClickHouse (Insert-Only Required)

- Auto-selects 'insert-only' strategy
- **No realtime option available** (enforced by storage adapter)
- Larger batch sizes recommended (5000-10000 spans)
- Longer wait times acceptable (10-30 seconds)

### PostgreSQL/MySQL (Flexible)

- Auto-selects 'batch-with-updates' strategy
- User can override to realtime for development
- Leverage native upsert capabilities (`ON CONFLICT`, `ON DUPLICATE KEY UPDATE`)
- Balance batch size with latency requirements

### Development/Testing

- In-memory stores auto-select 'realtime'
- SQL stores can be overridden to realtime for debugging
- No configuration changes needed for basic usage

## Configuration Examples

```typescript
// Zero config - intelligent auto-selection (recommended)
new DefaultExporter(mastra);

// Development override on SQL backend
new DefaultExporter(mastra, { strategy: 'realtime' });

// Tuned performance, auto strategy
new DefaultExporter(mastra, {
  maxBatchSize: 500,
  maxBatchWaitMs: 2000,
});

// ClickHouse high-throughput
new DefaultExporter(mastra, {
  maxBatchSize: 10000,
  maxBatchWaitMs: 30000,
  maxBufferSize: 100000,
});

// Low latency batching
new DefaultExporter(mastra, {
  maxBatchSize: 100,
  maxBatchWaitMs: 1000,
});
```

## Monitoring and Observability

### Built-in Metrics (via logger)

**Strategy Selection Logging:**

```typescript
this.logger.info('AI tracing exporter initialized', {
  strategy: resolvedStrategy,
  source: userConfig.strategy ? 'user' : 'auto',
  storageAdapter: storage.constructor.name,
  maxBatchSize: this.config.maxBatchSize,
});
```

**Batch Processing Metrics:**

```typescript
this.logger.debug('Batch flushed', {
  strategy: this.config.strategy,
  batchSize: buffer.totalSize,
  flushReason: 'size' | 'time' | 'shutdown' | 'overflow',
  durationMs: elapsed,
});
```

**Error Tracking:**

```typescript
this.logger.warn('Batch retry', {
  attempt: retryAttempt,
  maxRetries: this.config.maxRetries,
  nextRetryInMs: retryDelay,
});
```

## Implementation Benefits

### Intelligent Defaults

- **Zero configuration** for most users - just works out of the box
- Storage adapters automatically use optimal patterns
- Prevents misconfigurations (e.g., ClickHouse can't use realtime)

### Developer Flexibility

- Can override for local development needs
- Can force realtime for debugging
- Can tune batch sizes for specific workloads

### Simplified Error Handling

- No circuit breaker complexity
- Predictable retry behavior with linear backoff
- Clear failure modes and recovery paths

### Storage Compatibility

- **ClickHouse**: Only supports insert-only (enforced)
- **SQL databases**: Flexible, auto-select batch-with-updates
- **Development**: Can override to realtime for debugging

## Realistic Scale Expectations

### Span Volume Analysis

- **Single complex trace**: ~40-50 spans (agent + workflow steps + LLM calls + tools)
- **Production scenario**: 10 concurrent traces = 500 spans
- **Burst traffic**: Storage outages could accumulate thousands of spans

### Default Value Rationale

- **maxBatchSize: 1000** - Handles 20-25 complex traces per batch, excellent DB efficiency
- **maxBufferSize: 10000** - 10x safety margin, handles 5-10 minutes of storage outage
- **Memory usage**: 20-100MB total (very reasonable for production)

## Testing Strategy

### Unit Tests

#### Core Buffer Management

- **Event addition**: Test adding SPAN_STARTED, SPAN_UPDATED, SPAN_ENDED to appropriate buffers
- **Size tracking**: Verify totalSize increments correctly across all buffer types
- **Timer management**: Test timer scheduling, cancellation, and flush triggering
- **Buffer reset**: Ensure buffers clear properly after flush

#### Strategy Resolution

- **Auto-selection**: Mock storage hints and verify correct strategy selection
- **User overrides**: Test user-specified strategies are validated against storage support
- **Invalid configurations**: Test fallback behavior when user strategy not supported
- **Default behavior**: Verify backward compatibility with no config

#### Ordering Logic (Batch-With-Updates)

- **Span key generation**: Test `traceId:spanId` unique key creation
- **Sequence numbers**: Verify monotonic sequence generation per span
- **Create tracking**: Test seenSpans Set correctly tracks creates
- **Update sorting**: Verify updates sorted by span key, then sequence number
- **Out-of-order detection**: Test detection and logging when update arrives before create

#### Flush Triggers

- **Size-based flush**: Test flush when totalSize >= maxBatchSize
- **Time-based flush**: Test flush when maxBatchWaitMs elapsed since firstEventTime
- **Emergency flush**: Test immediate flush when totalSize >= maxBufferSize
- **Shutdown flush**: Test all pending events flushed on shutdown

#### Strategy-Specific Processing

- **Realtime**: Test immediate storage calls for each event
- **Batch-with-updates**: Test creates processed before updates, proper ordering
- **Insert-only**: Test only SPAN_ENDED events processed, others ignored

#### Retry Logic

- **Exponential backoff**: Test 500ms, 1s, 2s, 4s delay progression
- **Retry exhaustion**: Test batch dropped after 4 failed attempts
- **Success after retry**: Test successful flush after transient failure
- **Error logging**: Verify retry attempts logged with correct metadata

#### Serialization (Preserve Existing)

- **Attribute conversion**: Test existing serializeAttributes behavior
- **Date handling**: Test Date objects converted to ISO strings
- **Circular reference**: Test graceful handling of circular objects
- **Null attributes**: Test null returned for undefined attributes

#### Mock Requirements

- **Storage interface**: Mock batchCreateAISpans, batchUpdateAISpans, storage hints
- **Timer functions**: Mock setTimeout/clearTimeout for deterministic testing
- **Logger**: Mock logger to verify correct log levels and messages
- **Error conditions**: Mock storage failures for retry testing

## Implementation Approach

### Single Phase Implementation

- Replace existing `DefaultExporter` class entirely
- Maintain exact same public interface for backward compatibility
- Add optional config parameter with intelligent defaults
- All three strategies implemented together
- No breaking changes to existing deployments

### Code Structure Philosophy

**Maintain Current Readability Pattern:**

- Keep main `exportEvent()` method clear and explicit about strategy routing
- Use descriptive private methods for complex logic
- Preserve existing helper methods that work well
- Make the three strategies visually distinct in the main flow

### Key Implementation Details

#### Current DefaultExporter Structure (to preserve)

```typescript
// Current working methods to keep
- serializeAttributes(span: AnyAISpan): Record<string, any> | null
- buildCreateRecord(span: AnyAISpan): InternalAISpanRecord
- buildUpdateRecord(span: AnyAISpan): Partial<InternalAISpanRecord>

// Current types to reuse
type InternalAISpanRecord = Omit<AISpanRecord,'spanId' | 'traceId' | 'createdAt' | 'updatedAt'>;
```

#### Proposed Main Structure (Readable Flow)

```typescript
async exportEvent(event: AITracingEvent): Promise<void> {
  const storage = this.mastra.getStorage();
  if (!storage) {
    this.logger.warn('Cannot store traces. Mastra storage is not initialized');
    return;
  }

  const span = event.span;

  // Clear strategy routing - explicit and readable
  switch (this.resolvedStrategy) {
    case 'realtime':
      await this.handleRealtimeEvent(event, storage);
      break;
    case 'batch-with-updates':
      this.handleBatchWithUpdatesEvent(event);
      break;
    case 'insert-only':
      this.handleInsertOnlyEvent(event);
      break;
  }
}
```

#### Shared Private Methods (Complex Logic)

```typescript
// Strategy-specific handlers - keep main flow clear
private async handleRealtimeEvent(event: AITracingEvent, storage: MastraStorage): Promise<void>
private handleBatchWithUpdatesEvent(event: AITracingEvent): void
private handleInsertOnlyEvent(event: AITracingEvent): void

// Buffer management - hide complexity
private addToBuffer(event: AITracingEvent): void
private shouldFlush(): boolean
private async flush(): Promise<void>
private scheduleFlush(): void

// Ordering logic - encapsulate complexity
private buildSpanKey(traceId: string, spanId: string): string
private getNextSequence(spanKey: string): number
private handleOutOfOrderUpdate(event: AITracingEvent): void

// Retry logic - hide implementation details
private async retryBatch(batch: BatchBuffer, attempt: number): Promise<void>
private calculateRetryDelay(attempt: number): number
```

#### Storage Base Class Methods to Use

- `storage.batchCreateAISpans(args: { records: AISpanRecord[] }): Promise<void>`
- `storage.batchUpdateAISpans(args: { records: UpdateRecord[] }): Promise<void>`
- `storage.createAISpan(span: AISpanRecord): Promise<void>` (for realtime)
- `storage.updateAISpan(params: {...}): Promise<void>` (for realtime)

#### Strategy Resolution Implementation

```typescript
function resolveStrategy(userConfig: BatchingConfig, storage: MastraStorage): Strategy {
  if (userConfig.strategy && userConfig.strategy !== 'auto') {
    const hints = storage.aiTracingStrategy;
    if (hints.supported.includes(userConfig.strategy)) {
      return userConfig.strategy;
    }
    // Log warning and fall through to auto-selection
  }
  return storage.aiTracingStrategy.preferred;
}
```

#### Timer Implementation Pattern

```typescript
// Use setTimeout (not setInterval) for flush timing
private scheduleFlush(): void {
  if (this.flushTimer) clearTimeout(this.flushTimer);
  this.flushTimer = setTimeout(() => this.flush(), this.config.maxBatchWaitMs);
}
```

#### Exponential Backoff Implementation

```typescript
const retryDelay = this.config.retryDelayMs * Math.pow(2, attempt);
setTimeout(() => this.retryBatch(batch), retryDelay);
```

### Files to Modify

1. **packages/core/src/ai-tracing/exporters/default.ts** - Main implementation
2. **packages/core/src/storage/base.ts** - Add `aiTracingStrategy` getter
3. **Storage adapters** - Implement strategy hints (ClickHouse, PostgreSQL, etc.)
4. **packages/core/src/ai-tracing/exporters/default.test.ts** - Update tests

### Backward Compatibility Requirements

- `new DefaultExporter(mastra)` - Must work unchanged (auto-select strategy)
- `new DefaultExporter(mastra, undefined, logger)` - Must work unchanged
- All existing spans must be processed correctly
- No changes to span serialization behavior
- Preserve all current error handling and logging

This plan provides a comprehensive, production-ready batching solution that intelligently adapts to different storage backends while preserving simplicity and leveraging existing patterns from the Mastra codebase.
