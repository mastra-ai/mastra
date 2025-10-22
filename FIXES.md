# Potential Fixes for Memory Leak Issue #6322

## Status

⚠️ **These are potential fixes being explored** - Solutions are still being validated to ensure they don't break existing functionality.

## Critical Consideration

**Important Discovery**: Simply clearing buffers may break legitimate functionality. The EventEmitter pattern with buffering was introduced to support concurrent access to different stream views (fullStream, objectStream, textStream). Any fix must preserve this capability.

## Detailed Code Findings

### Finding #1: MastraModelOutput Unbounded Buffering

**Location**: `packages/core/src/stream/base/output.ts:67-134`

The `MastraModelOutput` class maintains 15+ buffer arrays that NEVER get cleared:

```typescript
#bufferedChunks: ChunkType<OUTPUT>[] = [];        // Stores EVERY chunk
#bufferedSteps: LLMStepResult[] = [];             // ALL steps accumulated
#bufferedText: LLMStepResult['text'][] = [];      // ALL text chunks
#bufferedTextChunks: Record<string, LLMStepResult['text'][]> = {};
#toolCallArgsDeltas: Record<string, LLMStepResult['text'][]> = {};
// ... plus 10+ more buffers
```

Impact: ~10-50MB memory growth per request

### Finding #2: Workflow Run Cache

**Location**: `packages/core/src/workflows/workflow.ts:408,1024`

Every `agent.stream()` call creates a workflow stored in `#runs` Map:

```typescript
#runs: Map<string, Run<...>> = new Map();
// Only cleans up if NOT suspended
if (result.status !== 'suspended') {
  this.cleanup?.();  // Removes from map
}
```

Impact: ~5-10MB per workflow

### Finding #3: ProcessorState Accumulation

**Location**: `packages/core/src/processors/runner.ts`

Each ProcessorState stores ALL stream parts:

```typescript
public streamParts: ChunkType<OUTPUT>[] = [];  // Unbounded!
private accumulatedText = '';                  // Concatenates forever

addPart(part: ChunkType<OUTPUT>): void {
  this.streamParts.push(part);  // Never cleared
  if (part.type === 'text-delta') {
    this.accumulatedText += part.payload.text;  // Grows forever
  }
}
```

### Finding #4: EventEmitter Listener Pattern

**Location**: `packages/core/src/stream/base/output.ts:1340-1351`

Each access to stream creates listeners:

```typescript
self.#emitter.on('chunk', chunkHandler);
self.#emitter.on('finish', finishHandler);
```

Cleanup only happens on finish, not on timeout or errors.

## Potential Fix 1: Clear Buffers After Stream Completion

**File**: `packages/core/src/stream/base/output.ts`

**Approach**: Add buffer cleanup after stream finishes

```typescript
#clearBuffers() {
  this.#bufferedChunks = [];
  this.#bufferedSteps = [];
  this.#bufferedText = [];
  this.#bufferedTextChunks = {};
  this.#toolCallArgsDeltas = {};
  // ... clear all 15+ buffers
}

// Call in finish handling
case 'finish':
  self.#status = 'success';
  // ... existing code ...
  self.#clearBuffers();  // ADD THIS
  break;
```

**Pros**:

- Directly addresses buffer accumulation
- Simple to implement

**Cons**:

- Would break concurrent stream access (fullStream + objectStream)
- May break replay functionality
- Could affect users who access streams multiple times

**Status**: ❌ Not viable as-is, would break functionality

## Potential Fix 2: ProcessorState Cleanup

**File**: `packages/core/src/processors/runner.ts`

**Approach**: Add finalize method to clear accumulated state

```typescript
finalize(): void {
  this.streamParts = [];
  this.accumulatedText = '';
  this.customState = {};
}
```

**Pros**:

- Clears workflow step state accumulation
- Less likely to break functionality

**Cons**:

- Only addresses part of the problem
- Need to ensure timing doesn't affect processing

**Status**: ⚠️ Viable but insufficient alone

## Potential Fix 3: Break Reference Cycles

**Approach**: Identify and break circular references preventing GC

**Investigation Needed**:

1. Do chunks reference back to MastraModelOutput?
2. Do EventEmitter listeners create retention?
3. Are workflow instances held by global references?

**Potential Implementation**:

```typescript
// Nullify references after use
#cleanup() {
  // Break potential circular references
  this.#bufferedChunks.forEach(chunk => {
    if (chunk.metadata) {
      chunk.metadata.output = null;
    }
  });

  // Remove event listeners
  this.#emitter.removeAllListeners();
}
```

**Status**: 🔍 Under investigation

## Potential Fix 4: Explicit Lifecycle Management

**Approach**: Add explicit destroy/dispose method for cleanup

```typescript
class MastraModelOutput {
  private disposed = false;

  dispose() {
    if (this.disposed) return;

    // Clear buffers only after ensuring no active consumers
    if (this.#activeStreamCount === 0) {
      this.#clearBuffers();
    }

    this.#emitter.removeAllListeners();
    this.disposed = true;
  }
}
```

**Usage**:

```typescript
const output = await agent.stream('prompt');
try {
  // Use streams
  await consumeStream(output.fullStream);
} finally {
  output.dispose(); // Explicit cleanup
}
```

**Pros**:

- Gives control to users
- Preserves functionality during active use

**Cons**:

- Requires API changes
- Users must remember to call dispose()

**Status**: 🤔 Potentially viable

## Potential Fix 5: Limit Buffer Size

**Approach**: Use circular buffers or size limits

```typescript
class CircularBuffer<T> {
  private buffer: T[];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.buffer = [];
    this.maxSize = maxSize;
  }

  push(item: T) {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift(); // Remove oldest
    }
    this.buffer.push(item);
  }
}

#bufferedChunks = new CircularBuffer<ChunkType<OUTPUT>>(100);
```

**Pros**:

- Bounds memory usage
- Simple to implement

**Cons**:

- May break replay for large streams
- Arbitrary size limits

**Status**: ⚠️ Possible fallback option

## Potential Fix 6: WeakMap/WeakRef for References

**Approach**: Use weak references to allow GC

```typescript
// Use WeakMap for storing references that can be GC'd
private streamConsumers = new WeakMap<ReadableStream, ConsumerData>();

// Or use WeakRef for the output itself
const outputRef = new WeakRef(output);
```

**Pros**:

- Allows garbage collection when not in use
- Preserves functionality

**Cons**:

- Complex to implement correctly
- WeakRef behavior can be unpredictable

**Status**: 🔍 Needs research

## Potential Fix 7: Fix MessageList Type Guards

**File**: `packages/core/src/agent/message-list/index.ts`

**Approach**: Add proper type checking

```typescript
static isMastraMessageV2(msg: MessageInput): msg is MastraMessageV2 {
  // Add type check first
  if (!msg || typeof msg !== 'object') {
    return false;
  }

  return Boolean(
    'content' in msg &&
      msg.content &&
      typeof msg.content === 'object' &&
      !Array.isArray(msg.content) &&
      'format' in msg.content &&
      msg.content.format === 2
  );
}
```

**Pros**:

- Prevents TypeErrors
- Simple defensive programming

**Cons**:

- Only fixes symptoms, not root cause

**Status**: ✅ Should implement regardless

## Exploration Priority

1. **First**: Understand reference cycles and what prevents GC
2. **Second**: Test if EventEmitter cleanup alone helps
3. **Third**: Consider API changes for explicit lifecycle
4. **Fourth**: Implement defensive type guards
5. **Last Resort**: Buffer size limits if nothing else works

## Testing Requirements

Any fix must:

1. Pass all existing tests
2. Not break concurrent stream access
3. Allow accessing fullStream and objectStream simultaneously
4. Support the structured output processor use case
5. Work under production load conditions

## Open Questions

1. What exactly keeps MastraModelOutput instances alive?
2. Can we detect when all streams are consumed?
3. Should cleanup be automatic or explicit?
4. How do other streaming libraries handle this?
5. Is the issue specific to certain deployment environments?

## Investigation Notes

### MessageList History Accumulation

**File**: `packages/core/src/agent/message-list/index.ts`

**Initial Hypothesis**: MessageList may accumulate unlimited message history in very long conversations

**Deep Investigation Results**:

- MessageList has `clear.input` and `clear.response` methods called by ProcessorRunner
- Memory messages (loaded from DB) are intentionally NOT cleared during execution
- **KEY FINDING**: MessageList is created fresh for each `agent.stream()` call
- After stream completes, entire MessageList instance is garbage collected
- Next stream creates NEW MessageList, loads fresh memory messages from DB
- Memory messages only accumulate within a SINGLE stream execution (intentional for context)

**Conclusion**: ❌ **NOT a memory leak** - MessageList is scoped to single stream and GC'd after. Database growth is separate concern (not in-memory leak).

### TypeError Root Cause Chain

**Location**: `packages/core/src/agent/message-list/index.ts:979`

The number 4822 being passed where message object expected:

1. Memory.query() gets vector results with missing metadata
2. Creates `include: [{ id: undefined, ...}]`
3. Storage returns malformed data (possibly count or index)
4. MessageList.add() receives number instead of message array
5. TypeError when checking `'format' in 4822`

## Next Steps

1. Create heap snapshots to identify retention paths
2. Test each approach in isolation
3. Measure impact on existing functionality
4. Get feedback on API changes if needed
5. Validate with production-like scenarios
