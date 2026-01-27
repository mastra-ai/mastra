# Pitfalls: v1.1 Agent Integration Features

**Milestone:** v1.1 Agent Integration (V2 model support, TripWire, Writer API, foreach index)
**Domain:** Event-driven workflow runtime extensions
**Researched:** 2026-01-27
**Confidence:** HIGH (based on codebase analysis, domain patterns, and v1.0 lessons)

## Executive Summary

Adding V2 model support, TripWire propagation, Writer API, and foreach index resume to an event-driven workflow runtime introduces serialization, state management, and error handling challenges unique to distributed execution. Unlike synchronous runtimes where objects maintain type identity and in-memory state persists, evented runtimes must serialize everything across event boundaries while preserving semantics.

**Most Critical Risk:** TripWire serialization losing type identity, causing workflow engine to mishandle it as a generic error instead of a tripwire event that should update workflow status correctly.

---

## Critical Pitfalls

Mistakes that cause test failures, incorrect behavior, or fundamental incompatibility.

### Pitfall 1: TripWire Loses Type Identity Across Event Boundaries

**What goes wrong:** TripWire extends Error. When a TripWire is thrown in an agent step and crosses event boundaries (serialized to JSON for pub/sub transport), it loses its prototype chain. On the receiving side, `tripwire instanceof TripWire` returns false, and the workflow engine treats it as a generic error instead of a tripwire event.

**Why it happens:**
- JSON serialization converts `TripWire` instance to plain object: `JSON.stringify(tripwire)` produces `{}`
- Even with custom `toJSON()`, deserialization creates plain objects, not TripWire instances
- Event-driven architecture requires serialization for pub/sub transport between workflow event processor and step executor
- Default runtime doesn't need this - TripWire stays in memory with prototype intact

**Consequences:**
- Workflow status becomes `'failed'` instead of `'tripwire'`
- `tripwire` metadata (reason, retry, processorId) is lost or incomplete
- onError callback fires when it shouldn't (tripwire ≠ error in Mastra semantics)
- Step results don't include tripwire information for debugging
- Resume/retry logic breaks because engine can't distinguish tripwire from genuine errors

**Warning signs:**
- Tests checking `result.status === 'tripwire'` fail, getting `'failed'` instead
- TripWire properties (reason, metadata, processorId) are undefined after event transport
- Error logs show generic "Error" instead of "TripWire"
- `instanceof TripWire` checks fail in workflow-event-processor
- Agent step tripwire tests pass in default runtime, fail in evented

**Prevention:**

1. **Serialize TripWire with explicit type marker:**
```typescript
// When catching TripWire in step executor (evented/step-executor.ts)
if (error instanceof TripWire) {
  return {
    status: 'tripwire' as const,
    error: {
      __type: 'TripWire',  // Type marker for deserialization
      name: 'TripWire',
      message: error.message,
      reason: error.message,
      retry: error.options.retry,
      metadata: error.options.metadata,
      processorId: error.processorId,
    },
    tripwire: {
      reason: error.message,
      retry: error.options.retry,
      metadata: error.options.metadata,
      processorId: error.processorId,
    },
  };
}
```

2. **Detect tripwire status from step result:**
```typescript
// In workflow-event-processor, check status field first
if (stepResult.status === 'tripwire') {
  // Handle as tripwire, not error
  await this.handleStepTripwire(stepResult);
  return;
}

// Fallback: check error.__type if status is 'failed'
if (stepResult.status === 'failed' && stepResult.error?.__type === 'TripWire') {
  // Upgrade to tripwire status
  stepResult.status = 'tripwire';
  await this.handleStepTripwire(stepResult);
  return;
}
```

3. **Preserve tripwire data in stepResults:**
```typescript
// Store tripwire info separately from error
stepResults[stepId] = {
  ...baseResult,
  status: 'tripwire',
  error: serializedError,
  tripwire: {
    reason: tripwire.reason,
    retry: tripwire.retry,
    metadata: tripwire.metadata,
    processorId: tripwire.processorId,
  },
};
```

4. **Test tripwire serialization round-trip explicitly:**
```typescript
it('should preserve TripWire across event boundaries', async () => {
  const tripwire = new TripWire('rate limit', { retry: true, metadata: { limit: 100 } });
  const serialized = JSON.stringify({ error: tripwire }); // Simulates pub/sub
  const deserialized = JSON.parse(serialized);

  // Must be able to detect it's a tripwire
  expect(deserialized.error.name).toBe('TripWire');
  expect(deserialized.error.retry).toBe(true);
});
```

**Relevance to v1.1:** Default runtime already handles TripWire (workflow.ts:418-464). Evented runtime must add equivalent support but with serialization awareness. Tests at evented-workflow.test.ts:12831, 12935 are skipped with reason "uses streamLegacy which does not support V2 models" - this milestone makes them pass.

**Which phase:** Phase 1 (TripWire propagation) - foundational for V2 agent steps

---

### Pitfall 2: V2 Model Stream API Differs From V1 streamLegacy

**What goes wrong:** Evented runtime currently uses `streamLegacy()` for agent steps (evented/workflow.ts:348). V2 models use a different streaming API (`stream()`) with different chunk types, event structure, and completion semantics. Code written for streamLegacy breaks when used with V2 models.

**Why it happens:**
- V2 model specification version has different streaming primitives
- Chunk types differ: streamLegacy emits text-delta chunks, V2 stream() has richer chunk types
- TripWire detection in chunk stream differs between APIs
- Default runtime already branches on `specificationVersion === 'v1'` (workflow.ts:381), evented doesn't

**Consequences:**
- V2 models throw errors when streamLegacy is called
- Agent steps with V2 models fail immediately
- Structured output (via V2) doesn't work in evented runtime
- TripWire chunks not detected in V2 stream
- Tests with V2 mock models fail

**Warning signs:**
- Error: "streamLegacy is not defined on V2 model"
- Agent steps work with V1 models, fail with V2 models
- Structured output tests skipped in evented (test line 12935)
- AgentOptions tests skipped in evented (test line 12831)
- Comment in code: "TODO: should use regular .stream()" (evented/workflow.ts:347)

**Prevention:**

1. **Branch on model specification version like default runtime:**
```typescript
// In createStepFromAgent (evented/workflow.ts ~line 348)
const model = await params.getModel();
if (model.specificationVersion === 'v1') {
  const { fullStream } = await params.streamLegacy(prompt, options);
  // Handle V1 streaming...
} else {
  // V2 path
  const modelOutput = await params.stream(prompt, options);
  const stream = modelOutput.fullStream;
  // Handle V2 streaming...
}
```

2. **Extract tripwire from both stream types:**
```typescript
// V2 streams emit tripwire chunks directly
for await (const chunk of stream) {
  if (chunk.type === 'tripwire') {
    tripwireChunk = chunk;
    break; // Stop processing on tripwire
  }
  await pubsub.publish(...); // Emit chunk event
}

if (tripwireChunk) {
  throw new TripWire(
    tripwireChunk.payload?.reason,
    { retry: tripwireChunk.payload?.retry, metadata: tripwireChunk.payload?.metadata },
    tripwireChunk.payload?.processorId
  );
}
```

3. **Support structured output (V2 feature):**
```typescript
let structuredResult: any = null;

const { fullStream } = await params.stream(prompt, {
  ...agentOptions,
  onFinish: result => {
    // V2 returns structured output in result.object
    if (agentOptions?.structuredOutput?.schema && 'object' in result) {
      structuredResult = result.object;
    }
    streamPromise.resolve(result.text);
  },
});

// After streaming completes
if (structuredResult !== null) {
  return structuredResult; // Return typed object, not {text}
}
```

4. **Test with both V1 and V2 mock models:**
```typescript
it('should support V2 model with structured output', async () => {
  const v2Model = new MockLanguageModelV2(); // V2 mock
  const agent = new Agent({ model: v2Model });
  const step = createStep(agent, { structuredOutput: { schema: z.object({...}) } });

  const result = await runWorkflowWithStep(step);
  expect(result).toMatchObject({ /* structured output shape */ });
});
```

**Relevance to v1.1:** This is the blocker for removing test skips. Default runtime supports both V1 and V2 (workflow.ts:381-416), evented must achieve parity.

**Which phase:** Phase 1 (V2 model support) - enables structured output and modern agent features

---

### Pitfall 3: Writer API State Across Async Event Boundaries

**What goes wrong:** Writer API allows steps to emit custom events/chunks during execution. In default runtime, writer is an in-memory object that accumulates writes synchronously. In evented runtime, step execution is async across events - writer must serialize writes to pub/sub, and state doesn't naturally persist between event processing cycles.

**Why it happens:**
- Default runtime: writer is passed as object reference, all writes happen in same execution context
- Evented runtime: step executor runs in separate event handler, writer must be reconstructed from event
- Current evented code has `writer: undefined as any` (step-executor.ts:149, 327, 402, 477)
- Writer protocol requires writing to a stream that may span multiple async operations

**Consequences:**
- `writer.write()` throws "Cannot read property 'write' of undefined"
- Custom events from steps never reach workflow consumers
- Writer.custom() for emitting domain events doesn't work
- Streaming output during resume loses writer context
- Tests checking writer output fail (test line 1851, 1938 skipped)

**Warning signs:**
- TypeError: "Cannot call write on undefined"
- Custom events missing from workflow event stream
- Tests with writer.custom() are skipped (evented-workflow.test.ts:1851, 1938)
- Comment: "evented runtime does not expose writer in step context"
- Writer-related test at parallel-writer.test.ts might fail for evented

**Prevention:**

1. **Create OutputWriter backed by pub/sub:**
```typescript
// In step-executor.ts execute()
const writer: OutputWriter = {
  write: async (chunk: any) => {
    // Publish chunk to workflow event stream
    await params.emitter.emit('chunk', {
      stepId: step.id,
      runId,
      chunk,
    });
  },
  custom: async (event: { type: string; data: any }) => {
    // Publish custom event
    await params.emitter.emit('custom', {
      stepId: step.id,
      runId,
      event,
    });
  },
};

// Pass to step execute
const stepOutput = await step.execute({
  // ... other context
  writer, // Now defined
});
```

2. **Forward writer events to workflow pub/sub:**
```typescript
// In workflow-event-processor
this.emitter.on('chunk', async (data) => {
  await this.pubsub.publish(`workflow.events.v2.${data.runId}`, {
    type: 'watch',
    runId: data.runId,
    data: {
      type: 'step-chunk',
      stepId: data.stepId,
      chunk: data.chunk,
    },
  });
});
```

3. **Handle writer in resume path:**
```typescript
// Resume must also provide writer
async handleResumeStep(resumeEvent) {
  const writer = this.createWriterForStep(resumeEvent.stepId, resumeEvent.runId);

  const result = await this.stepExecutor.execute({
    // ... resume params
    writer, // Writer available during resume
  });
}
```

4. **Test writer across suspend/resume:**
```typescript
it('should emit custom events via writer during resume', async () => {
  const events: any[] = [];

  const step = createStep({
    execute: async ({ writer, suspend, resumeData }) => {
      if (!resumeData) {
        await writer.custom({ type: 'before-suspend', data: 'first' });
        return suspend({ value: 1 });
      }
      await writer.custom({ type: 'after-resume', data: 'second' });
      return { done: true };
    },
  });

  workflow.on('custom', e => events.push(e));

  await run.execute();
  await run.resume({});

  expect(events).toHaveLength(2);
  expect(events[0].type).toBe('before-suspend');
  expect(events[1].type).toBe('after-resume');
});
```

**Relevance to v1.1:** Two skipped tests explicitly mention writer (1851, 1938). V2 streaming API interacts with writer for chunk emission. This unblocks advanced streaming use cases.

**Which phase:** Phase 2 (Writer API) - required for custom event emission from steps

---

### Pitfall 4: Foreach Index Resume Parameter Missing Type and Plumbing

**What goes wrong:** Default runtime's `resume()` method accepts `forEachIndex` parameter to resume a specific iteration of a foreach loop (workflow.test.ts:7988). Evented runtime lacks this parameter - users must cast with `as any` to use it (evented-workflow.test.ts:19182). Even if the type is added, plumbing from EventedRun → workflow-event-processor → step-executor is missing.

**Why it happens:**
- Default runtime added forEachIndex in handlers/control-flow.ts (line 760, 866)
- Evented runtime's EventedRun.resume() doesn't have forEachIndex in type signature
- workflow-event-processor doesn't extract forEachIndex from resume event
- step-executor receives foreachIdx but not from resume path
- Foreach iterations store foreachIndex in suspendPayload.__workflow_meta (control-flow.ts:980)

**Consequences:**
- Users can't resume specific foreach iteration in evented runtime
- All foreach iterations resume together (incorrect behavior)
- Type error when passing forEachIndex to evented resume
- Tests cast `as any` to bypass type error (test line 19182, 19186, 19190)
- Partial concurrency foreach can't resume correctly (test line 19483)

**Warning signs:**
- Test comment: "forEachIndex is not implemented in evented runtime" (line 19181)
- Resume calls use `as any` cast (line 19182)
- Skipped test reason: "does not implement the `forEachIndex` parameter" (line 18913)
- Multiple tests with forEachIndex are skipped (lines 19119-19492)
- Type error: "forEachIndex does not exist on type ResumeParams"

**Prevention:**

1. **Add forEachIndex to EventedRun.resume() signature:**
```typescript
// In evented/workflow.ts EventedRun class
async resume(params?: {
  resumeData?: TResumeData;
  resumeLabel?: string;
  forEachIndex?: number; // ADD THIS
}) {
  const resumeEvent = {
    type: 'workflow.resume',
    workflowId: this.workflowId,
    runId: this.runId,
    resumeData: params?.resumeData,
    resumeLabel: params?.resumeLabel,
    forEachIndex: params?.forEachIndex, // Pass through
  };

  await this.pubsub.publish(`workflow.events.v2.${this.runId}`, resumeEvent);
}
```

2. **Extract forEachIndex in workflow-event-processor:**
```typescript
// In handleResumeEvent
private async handleResumeEvent(event: any) {
  const { resumeData, resumeLabel, forEachIndex } = event;

  // Find suspended step
  const suspendedStepId = this.findSuspendedStep(resumeLabel);

  // Check if this is a foreach resume
  if (forEachIndex !== undefined) {
    const suspendPayload = stepResults[suspendedStepId]?.suspendPayload;
    const storedIndex = suspendPayload?.__workflow_meta?.foreachIndex;

    // Only resume if index matches
    if (storedIndex !== forEachIndex) {
      return; // Skip this resume, wrong iteration
    }
  }

  // Execute resume with index context
  await this.executeStep({
    stepId: suspendedStepId,
    resumeData,
    foreachIndex: forEachIndex, // Pass to executor
  });
}
```

3. **Persist foreachIndex in suspend metadata:**
```typescript
// Already done in step-executor.ts:130 (from v1.0)
resumeLabels[label] = {
  stepId: step.id,
  foreachIndex: params.foreachIdx, // Stored correctly
};

// Ensure __workflow_meta includes foreachIndex
suspended = {
  payload: {
    ...suspendData,
    __workflow_meta: {
      runId,
      path: [step.id],
      foreachIndex: params.foreachIdx, // Stored for resume matching
      resumeLabels,
    },
  },
};
```

4. **Test foreach index resume explicitly:**
```typescript
it('should resume specific foreach iteration by index', async () => {
  const results: number[] = [];

  const step = createStep({
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) {
        return suspend({ iteration: inputData });
      }
      results.push(resumeData.value);
      return { done: true };
    },
  });

  const workflow = createWorkflow({ name: 'test-foreach' })
    .forEach([1, 2, 3])
    .do(step)
    .commit();

  const run = workflow.createRun();
  await run.execute(); // All 3 iterations suspend

  // Resume out of order by index
  await run.resume({ resumeData: { value: 100 }, forEachIndex: 2 }); // iteration 3
  await run.resume({ resumeData: { value: 200 }, forEachIndex: 0 }); // iteration 1
  await run.resume({ resumeData: { value: 300 }, forEachIndex: 1 }); // iteration 2

  expect(results).toEqual([100, 200, 300]); // Resumed by index, not order
});
```

**Relevance to v1.1:** Default runtime supports this (workflow.test.ts:7988-8030). Four tests are skipped in evented (19119, 19419) because this feature is missing. This unblocks complex foreach suspend/resume scenarios.

**Which phase:** Phase 3 (Foreach index resume) - enables fine-grained foreach control

---

### Pitfall 5: Serialized Tripwire Metadata Loses Structure

**What goes wrong:** TripWire metadata is strongly typed generic: `TripWire<TMetadata>`. When serialized to JSON and deserialized, metadata becomes plain object. If metadata contains nested objects, class instances, or non-JSON-serializable data (functions, symbols), structure is lost.

**Why it happens:**
- JSON.stringify() only serializes enumerable own properties
- Class instances lose prototype chain and methods
- Nested objects flatten
- Functions, symbols, undefined values disappear
- Default runtime keeps TripWire in memory, metadata never serialized

**Consequences:**
- Metadata type information lost (TypeScript can't enforce shape after deserialization)
- Processor-specific metadata (e.g., RateLimitMetadata with retry-after timestamp) becomes generic object
- Metadata methods (if metadata was a class) become undefined
- Workflow logic depending on metadata structure breaks
- Debugging harder - metadata looks like `{[Object object]}`

**Warning signs:**
- `tripwire.metadata.someMethod is not a function`
- Type assertions needed after deserialization: `metadata as MyMetadata`
- Metadata log shows `[object Object]` instead of useful structure
- Nested metadata properties are undefined
- Tests mocking TripWire with rich metadata fail

**Prevention:**

1. **Document metadata must be JSON-serializable:**
```typescript
// In trip-wire.ts documentation
/**
 * TripWire metadata for event-driven workflows.
 *
 * IMPORTANT: In evented workflows, metadata must be JSON-serializable.
 * - Use plain objects, not class instances
 * - Avoid functions, symbols, circular references
 * - Dates should be ISO strings, not Date objects
 *
 * @example
 * // Good: plain object
 * throw new TripWire('rate limit', {
 *   metadata: { limit: 100, resetAt: '2026-01-27T10:00:00Z' }
 * });
 *
 * // Bad: class instance
 * throw new TripWire('rate limit', {
 *   metadata: new RateLimitInfo(100) // Will lose methods
 * });
 */
```

2. **Validate metadata structure on serialization:**
```typescript
// In step-executor when catching TripWire
function serializeTripwireMetadata(metadata: unknown): unknown {
  try {
    const json = JSON.stringify(metadata);
    const parsed = JSON.parse(json);

    // Warn if serialization changed structure
    if (JSON.stringify(parsed) !== json) {
      console.warn('TripWire metadata lost structure during serialization');
    }

    return parsed;
  } catch (err) {
    console.error('TripWire metadata is not JSON-serializable', err);
    return { error: 'metadata not serializable' };
  }
}
```

3. **Use TypeScript branded types for validation:**
```typescript
// Define serializable metadata type
type SerializableMetadata = {
  [key: string]: string | number | boolean | null | SerializableMetadata | SerializableMetadata[];
};

// Brand TripWire for evented workflows
export class EventedTripWire<TMetadata extends SerializableMetadata = SerializableMetadata>
  extends TripWire<TMetadata> {
  constructor(reason: string, options: TripWireOptions<TMetadata>, processorId?: string) {
    super(reason, options, processorId);

    // Runtime validation
    if (options.metadata && !isJsonSerializable(options.metadata)) {
      throw new Error('TripWire metadata must be JSON-serializable in evented workflows');
    }
  }
}
```

4. **Test metadata round-trip:**
```typescript
it('should preserve tripwire metadata structure after serialization', () => {
  const originalMetadata = {
    limit: 100,
    resetAt: '2026-01-27T10:00:00Z',
    nested: { reason: 'quota', retryable: true },
  };

  const tripwire = new TripWire('rate limit', { metadata: originalMetadata });

  // Simulate event serialization
  const serialized = JSON.stringify({
    error: {
      name: 'TripWire',
      message: tripwire.message,
      metadata: tripwire.options.metadata,
    },
  });

  const deserialized = JSON.parse(serialized);

  // Metadata structure preserved
  expect(deserialized.error.metadata).toEqual(originalMetadata);
  expect(deserialized.error.metadata.nested.retryable).toBe(true);
});
```

**Relevance to v1.1:** When adding TripWire support, metadata serialization is often overlooked. Without this constraint, processors might pass non-serializable metadata that breaks in production but not in development (default runtime).

**Which phase:** Phase 1 (TripWire propagation) - architectural constraint for distributed execution

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt but don't fundamentally break features.

### Pitfall 6: Writer Chunks Don't Preserve Streaming Order

**What goes wrong:** When writer emits chunks during step execution, chunks are published to pub/sub individually. If pub/sub doesn't guarantee ordering (Redis Pub/Sub, some cloud providers under load), chunks may arrive out of order at consumers.

**Why it happens:**
- Writer.write() publishes each chunk as separate event
- Pub/sub systems vary in ordering guarantees
- Network partitions or retries can reorder events
- Chunk order matters for streaming output reconstruction

**Consequences:**
- Streaming text appears garbled (chunks out of order)
- Custom events fire in wrong sequence
- Workflow consumers see inconsistent state
- Tests pass locally (EventEmitterPubSub is ordered), fail with real pub/sub

**Warning signs:**
- Streaming text has words out of order
- Custom event timestamps show earlier events arriving later
- Workflow event log shows step-chunk events interleaved incorrectly
- Different behavior with EventEmitterPubSub vs Redis Pub/Sub

**Prevention:**

1. **Add sequence numbers to chunks:**
```typescript
let chunkSequence = 0;

const writer: OutputWriter = {
  write: async (chunk: any) => {
    await pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: {
        type: 'step-chunk',
        stepId: step.id,
        chunk,
        sequence: chunkSequence++, // Monotonic sequence
      },
    });
  },
};
```

2. **Buffer and reorder on consumer side:**
```typescript
// In workflow consumer
const chunkBuffer = new Map<number, any>();
let expectedSequence = 0;

function handleChunkEvent(event: any) {
  const { chunk, sequence } = event.data;

  if (sequence === expectedSequence) {
    // In order, emit immediately
    emitChunk(chunk);
    expectedSequence++;

    // Check buffer for next sequences
    while (chunkBuffer.has(expectedSequence)) {
      emitChunk(chunkBuffer.get(expectedSequence)!);
      chunkBuffer.delete(expectedSequence);
      expectedSequence++;
    }
  } else {
    // Out of order, buffer it
    chunkBuffer.set(sequence, chunk);
  }
}
```

3. **Use ordered pub/sub topics:**
```typescript
// Group all chunks for a step under same topic partition key
await pubsub.publish(`workflow.events.v2.${runId}`, event, {
  partitionKey: `${runId}:${stepId}`, // Same key = ordered delivery
});
```

4. **Document EventEmitterPubSub ordering guarantee:**
```typescript
/**
 * EventEmitterPubSub provides ordering guarantees (synchronous delivery).
 *
 * For production, use ordered pub/sub:
 * - Redis Streams (not Pub/Sub) with consumer groups
 * - Google Cloud Pub/Sub with ordering keys
 * - Kafka with partition keys
 */
```

**Relevance to v1.1:** Writer API is new, ordering wasn't a concern yet. As users adopt writer for streaming, ordering issues will surface.

**Which phase:** Phase 2 (Writer API) - polish after basic writer works

---

### Pitfall 7: V2 Structured Output Type Mismatch With Workflow Types

**What goes wrong:** V2 models with structured output return typed objects (via Zod schema). Workflow step output type must match this structured schema. If workflow expects `{ text: string }` but V2 returns `{ name: string; age: number }`, TypeScript types diverge from runtime behavior.

**Why it happens:**
- V2 structured output shape determined by agentOptions.structuredOutput.schema
- Workflow step type TStepOutput declared independently
- Type mismatch not caught at compile time if step output type is generic
- Default runtime already handles this (workflow.ts:471), evented must match

**Consequences:**
- Type errors when accessing step result properties
- Next step receives unexpected data shape
- Runtime errors: "Cannot read property 'text' of undefined"
- Tests checking output shape fail

**Warning signs:**
- TypeScript error: "Property 'text' does not exist on type ..."
- Result has unexpected properties
- Next step gets wrong input shape
- getStepResult() returns data that doesn't match declared type

**Prevention:**

1. **Infer step output type from structured schema:**
```typescript
function createStep<TSchema extends z.ZodType>(
  agent: Agent,
  options: { structuredOutput: { schema: TSchema } }
): Step<string, any, any, z.infer<TSchema>, any, any, any> {
  // Step output type automatically matches schema
}
```

2. **Runtime validation of structured output:**
```typescript
if (agentOptions?.structuredOutput?.schema) {
  const schema = agentOptions.structuredOutput.schema;

  // After agent finishes
  const validatedOutput = schema.parse(structuredResult);
  return validatedOutput; // Type-safe
}
```

3. **Document type alignment requirement:**
```typescript
/**
 * When using structured output with V2 models, ensure step output type matches schema:
 *
 * @example
 * const schema = z.object({ name: z.string(), age: z.number() });
 *
 * // Correct: output type matches schema
 * const step = createStep<string, typeof schema, any, z.infer<typeof schema>>(agent, {
 *   structuredOutput: { schema }
 * });
 *
 * // Incorrect: output type mismatch
 * const step = createStep<string, any, any, { text: string }>(agent, {
 *   structuredOutput: { schema } // Returns {name, age} but type expects {text}
 * });
 */
```

4. **Test structured output type safety:**
```typescript
it('should type-check structured output', async () => {
  const outputSchema = z.object({ result: z.number() });

  const step = createStep(agent, {
    structuredOutput: { schema: outputSchema }
  });

  const workflow = createWorkflow({ name: 'test' })
    .step(step)
    .commit();

  const result = await workflow.createRun().execute();

  // TypeScript should infer result.steps[step.id].output as { result: number }
  const output: { result: number } = result.steps[step.id].output;
  expect(output.result).toBeTypeOf('number');
});
```

**Relevance to v1.1:** V2 models enable structured output. Type safety prevents runtime errors when workflows compose V2 agent steps.

**Which phase:** Phase 1 (V2 model support) - get types right from the start

---

### Pitfall 8: Foreach Resume With forEachIndex Doesn't Validate Index Range

**What goes wrong:** User calls `resume({ forEachIndex: 999 })` on a foreach with 3 iterations. No validation → tries to resume non-existent iteration → undefined behavior or silent failure.

**Why it happens:**
- forEachIndex is optional parameter, no bounds checking
- Foreach loop doesn't track total iteration count in metadata
- Step executor doesn't know how many iterations exist
- Default runtime may have same issue (not explicitly tested in test file)

**Consequences:**
- Resume silently does nothing (index out of range)
- Confusing behavior for users (why didn't it resume?)
- Potential array out of bounds if foreach stores results by index
- Debugging difficulty (no clear error message)

**Warning signs:**
- Resume call returns success but workflow state unchanged
- No error thrown for invalid index
- Foreach results array has undefined holes
- Log shows "No suspended step found for index 999"

**Prevention:**

1. **Store iteration count in suspend metadata:**
```typescript
// In foreach handler when suspending
__workflow_meta: {
  foreachIndex: i,
  foreachTotal: iterationCount, // Total iterations
  // ...
}
```

2. **Validate index on resume:**
```typescript
private async handleResumeEvent(event: any) {
  const { forEachIndex } = event;

  if (forEachIndex !== undefined) {
    const suspendMeta = stepResults[suspendedStepId]?.suspendPayload?.__workflow_meta;
    const total = suspendMeta?.foreachTotal;

    if (total && forEachIndex >= total) {
      throw new Error(
        `forEachIndex ${forEachIndex} out of range for foreach with ${total} iterations`
      );
    }
  }

  // ...
}
```

3. **Document index validation:**
```typescript
/**
 * Resume a suspended foreach iteration.
 *
 * @param forEachIndex - Zero-based index of iteration to resume (0 to N-1)
 * @throws {Error} If forEachIndex is out of range
 */
async resume(params: { forEachIndex?: number }) { ... }
```

4. **Test boundary conditions:**
```typescript
it('should throw error for out-of-range forEachIndex', async () => {
  const workflow = createWorkflow({ name: 'test' })
    .forEach([1, 2, 3])
    .do(step)
    .commit();

  const run = workflow.createRun();
  await run.execute(); // 3 iterations

  await expect(
    run.resume({ forEachIndex: 5 }) // Out of range
  ).rejects.toThrow('forEachIndex 5 out of range for foreach with 3 iterations');
});
```

**Relevance to v1.1:** forEachIndex is new feature. Validation prevents silent failures and improves developer experience.

**Which phase:** Phase 3 (Foreach index resume) - include validation with feature

---

### Pitfall 9: Writer Events Published Before Step Start Event

**What goes wrong:** Step execution calls writer.write() immediately, publishing chunk event. But the step-start event is published later (or not at all in some code paths). Consumers see chunks for a step they don't know about yet.

**Why it happens:**
- Writer is synchronous (write immediately publishes)
- Step lifecycle events (start, finish) published separately
- Event ordering not guaranteed across different publish calls
- Race condition in event consumer

**Consequences:**
- Consumers throw "Unknown step ID" errors
- UIs show chunks for steps not in the workflow yet
- Workflow visualization breaks (step not in graph yet)
- Event replay fails (chunks before start)

**Warning signs:**
- Logs show "step-chunk for step-123 but step not started"
- UI shows chunks appearing before step node
- Event stream has chunk before step-start timestamp
- Tests with writer fail intermittently

**Prevention:**

1. **Publish step-start before executing:**
```typescript
// In workflow-event-processor before executeStep
await this.pubsub.publish(`workflow.events.v2.${runId}`, {
  type: 'watch',
  runId,
  data: {
    type: 'step-start',
    stepId: step.id,
    timestamp: Date.now(),
  },
});

// Now safe to execute (writer can emit)
const result = await this.stepExecutor.execute({ ... });
```

2. **Buffer writer events until step starts:**
```typescript
class BufferedWriter implements OutputWriter {
  private buffer: any[] = [];
  private started = false;

  async write(chunk: any) {
    if (!this.started) {
      this.buffer.push(chunk);
    } else {
      await this.pubsub.publish(...);
    }
  }

  async markStarted() {
    this.started = true;
    for (const chunk of this.buffer) {
      await this.pubsub.publish(...);
    }
    this.buffer = [];
  }
}
```

3. **Use single ordered event stream:**
```typescript
// Publish lifecycle and chunks to same topic
await pubsub.publish(`step.${stepId}.events`, {
  sequence: getNextSequence(),
  type: 'start', // or 'chunk', 'finish'
  data: { ... },
});
```

4. **Test event ordering:**
```typescript
it('should receive step-start before first chunk', async () => {
  const events: any[] = [];

  workflow.on('watch', e => events.push(e.data.type));

  const step = createStep({
    execute: async ({ writer }) => {
      await writer.write({ text: 'chunk1' });
      return { done: true };
    },
  });

  await runWorkflowWithStep(step);

  const startIndex = events.indexOf('step-start');
  const chunkIndex = events.indexOf('step-chunk');

  expect(startIndex).toBeLessThan(chunkIndex);
});
```

**Relevance to v1.1:** Writer API introduces new event type. Lifecycle event ordering wasn't critical before.

**Which phase:** Phase 2 (Writer API) - ensure correct event order

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable without architecture changes.

### Pitfall 10: TripWire Retry Logic Not Implemented in Evented Runtime

**What goes wrong:** TripWire has `options.retry: boolean`. When true, agent should retry with tripwire reason as feedback (adding to message history). Default runtime implements this, evented runtime might not.

**Why it happens:**
- TripWire retry is agent-level feature
- Evented runtime added TripWire serialization but might not add retry logic
- Retry requires re-executing step with modified context
- Default runtime handles this in agent execution (trip-wire.ts:getModelOutputForTripwire)

**Consequences:**
- TripWire with retry=true doesn't retry, just fails
- Agent can't self-correct on tripwire
- Tests checking retry behavior fail

**Prevention:**

1. **Implement retry in step executor:**
```typescript
if (stepResult.status === 'tripwire' && stepResult.tripwire?.retry) {
  // Re-execute with tripwire feedback
  const retryInput = {
    ...inputData,
    __tripwire_feedback: stepResult.tripwire.reason,
  };

  return this.stepExecutor.execute({
    ...params,
    input: retryInput,
    retryCount: (params.retryCount || 0) + 1,
  });
}
```

2. **Test tripwire retry:**
```typescript
it('should retry agent step on tripwire with retry=true', async () => {
  let attempts = 0;

  const agent = new Agent({
    model,
    processors: [
      (msg) => {
        attempts++;
        if (attempts === 1) {
          throw new TripWire('Try again', { retry: true });
        }
        return msg;
      },
    ],
  });

  const step = createStep(agent);
  const result = await runWorkflowWithStep(step);

  expect(attempts).toBe(2); // First attempt + retry
  expect(result.status).not.toBe('tripwire');
});
```

**Relevance to v1.1:** TripWire retry is part of TripWire feature, should be complete.

**Which phase:** Phase 1 (TripWire propagation) - implement full TripWire semantics

---

### Pitfall 11: Writer.custom() Event Type Collision

**What goes wrong:** Multiple steps emit custom events with same type name (e.g., `{ type: 'progress' }`). Consumers can't distinguish which step emitted which event.

**Why it happens:**
- Custom event type is user-defined string
- No namespace enforcement
- Event consumers receive all custom events
- No built-in stepId association

**Consequences:**
- Event handlers fire for wrong step
- Debugging confusion (which step emitted this?)
- Event filters break
- Tests checking specific step events fail

**Prevention:**

1. **Automatically include stepId in custom events:**
```typescript
custom: async (event: { type: string; data: any }) => {
  await pubsub.publish(`workflow.events.v2.${runId}`, {
    type: 'watch',
    runId,
    data: {
      type: 'custom',
      customType: event.type, // User's type
      stepId: step.id, // Always include
      data: event.data,
    },
  });
}
```

2. **Document event namespacing:**
```typescript
/**
 * Emit custom events from step execution.
 *
 * Events automatically include stepId for filtering.
 *
 * @example
 * writer.custom({ type: 'progress', data: { percent: 50 } });
 *
 * // Consumer receives:
 * {
 *   type: 'custom',
 *   customType: 'progress',
 *   stepId: 'my-step',
 *   data: { percent: 50 }
 * }
 */
```

3. **Test stepId included:**
```typescript
it('should include stepId in custom events', async () => {
  let receivedEvent: any;

  workflow.on('watch', e => {
    if (e.data.type === 'custom') {
      receivedEvent = e.data;
    }
  });

  await runWorkflow();

  expect(receivedEvent).toMatchObject({
    type: 'custom',
    customType: 'progress',
    stepId: expect.any(String),
  });
});
```

**Relevance to v1.1:** Writer.custom() is new API, good to establish conventions early.

**Which phase:** Phase 2 (Writer API) - include in initial implementation

---

### Pitfall 12: Foreach Index Resume Doesn't Handle Completed Iterations

**What goes wrong:** User calls `resume({ forEachIndex: 1 })` but iteration 1 already completed. Workflow tries to resume completed step → unexpected behavior or error.

**Why it happens:**
- Resume doesn't check if iteration already has success status
- Foreach tracks suspended iterations but not completed ones
- User might resume wrong index by mistake

**Consequences:**
- Completed step re-executes (side effects happen twice)
- Workflow result has duplicate entries
- Idempotency violated

**Prevention:**

1. **Check iteration status before resume:**
```typescript
private async handleResumeEvent(event: any) {
  const { forEachIndex } = event;

  if (forEachIndex !== undefined) {
    const iterationResult = stepResults[suspendedStepId]?.output?.[forEachIndex];

    if (iterationResult?.status === 'success') {
      throw new Error(
        `Cannot resume forEachIndex ${forEachIndex}: iteration already completed`
      );
    }

    if (iterationResult?.status !== 'suspended') {
      throw new Error(
        `Cannot resume forEachIndex ${forEachIndex}: iteration status is ${iterationResult?.status}`
      );
    }
  }

  // ...
}
```

2. **Test resume of completed iteration:**
```typescript
it('should throw error when resuming completed foreach iteration', async () => {
  const workflow = createWorkflow({ name: 'test' })
    .forEach([1, 2, 3])
    .do(stepWithSuspend)
    .commit();

  const run = workflow.createRun();
  await run.execute();

  // Resume index 0
  await run.resume({ resumeData: {}, forEachIndex: 0 });

  // Try to resume index 0 again (already completed)
  await expect(
    run.resume({ resumeData: {}, forEachIndex: 0 })
  ).rejects.toThrow('iteration already completed');
});
```

**Relevance to v1.1:** forEachIndex is new, validation prevents misuse.

**Which phase:** Phase 3 (Foreach index resume) - include with validation

---

## Phase-Specific Warnings

| Phase Topic                | Likely Pitfall                                | Mitigation                                                |
| -------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| V2 model support           | TripWire loses type identity (#1)             | Serialize with type marker, detect by status field        |
| V2 model support           | streamLegacy vs stream API (#2)               | Branch on specificationVersion like default runtime       |
| V2 model support           | Structured output type mismatch (#7)          | Infer types from schema, validate at runtime              |
| TripWire propagation       | Metadata loses structure (#5)                 | Document JSON-serializable constraint, validate           |
| TripWire propagation       | Retry logic not implemented (#10)             | Implement retry with feedback like default runtime        |
| Writer API                 | Writer undefined in step context (#3)         | Create OutputWriter backed by pub/sub                     |
| Writer API                 | Writer chunks out of order (#6)               | Add sequence numbers, use ordered pub/sub                 |
| Writer API                 | Events published before step-start (#9)       | Publish step-start before executing, or buffer            |
| Writer API                 | Custom event type collision (#11)             | Automatically include stepId in custom events             |
| Foreach index resume       | Missing type and plumbing (#4)                | Add forEachIndex param, extract in processor, pass to executor |
| Foreach index resume       | Index out of range (#8)                       | Validate against foreachTotal in metadata                 |
| Foreach index resume       | Resume completed iteration (#12)              | Check iteration status before resume                      |

## Cross-Feature Interactions

| Feature Combination           | Risk                                                                                          | Prevention                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| V2 model + TripWire           | TripWire in V2 stream not detected (different chunk structure)                                | Test tripwire detection in both V1 and V2 streams                       |
| V2 model + Writer             | Structured output bypasses writer (written to result, not emitted as chunks)                  | Document: structured output is final result, not streaming              |
| TripWire + Foreach            | Tripwire in one foreach iteration fails entire loop (should only fail that iteration)         | Handle tripwire at iteration level, not loop level                      |
| Writer + Foreach              | Writer events from parallel iterations interleave unpredictably                               | Include foreachIndex in writer events for filtering                     |
| Foreach index + Resume labels | User provides both forEachIndex and resumeLabel (which takes precedence?)                     | Document precedence: resumeLabel applies within forEachIndex context    |
| Writer + Suspend/Resume       | Writer events during suspend don't reach consumer (step execution terminates)                 | Flush writer buffer before suspend, resume writer on resume             |

## Detection Checklist

Before declaring v1.1 complete, verify:

### V2 Model Support
- [ ] Agent steps work with V2 mock models
- [ ] Structured output returns correct type (not `{text: string}`)
- [ ] Tests at line 12831, 12935 pass (currently skipped)
- [ ] TripWire detected in V2 stream chunks
- [ ] Both V1 and V2 models tested in same workflow

### TripWire Propagation
- [ ] TripWire crossing event boundary preserves reason, retry, metadata
- [ ] Workflow status is `'tripwire'` not `'failed'` when agent throws TripWire
- [ ] TripWire metadata survives JSON serialization round-trip
- [ ] TripWire retry=true causes agent to retry with feedback
- [ ] stepResults includes tripwire info for debugging

### Writer API
- [ ] writer.write() doesn't throw "undefined" error
- [ ] writer.custom() events reach workflow consumers
- [ ] Tests at line 1851, 1938 pass (currently skipped)
- [ ] Writer events include stepId
- [ ] Writer works in both initial execution and resume paths
- [ ] Step-start event precedes first writer chunk

### Foreach Index Resume
- [ ] resume({ forEachIndex: N }) type checks (no `as any`)
- [ ] Tests at line 19119, 19419 pass (currently skipped)
- [ ] Out-of-range index throws validation error
- [ ] Completed iteration resume throws error
- [ ] Foreach iterations can resume in any order
- [ ] foreachIndex in __workflow_meta survives serialization

### Integration
- [ ] V2 agent step can throw TripWire (both features work together)
- [ ] V2 agent step can use writer (both features work together)
- [ ] Foreach with V2 agent steps and structured output works
- [ ] Foreach iteration can suspend, throw TripWire, and resume by index
- [ ] No regressions in v1.0 test suite (189 tests still pass)

## Sources

**Codebase Analysis (HIGH confidence):**
- packages/core/src/workflows/evented/ directory (25,587 lines)
- packages/core/src/workflows/workflow.ts (default runtime reference)
- packages/core/src/workflows/evented/evented-workflow.test.ts (skipped tests document gaps)
- packages/core/src/agent/trip-wire.ts (TripWire class definition)
- packages/core/src/workflows/types.ts (type definitions)
- .planning/research/PITFALLS.md (v1.0 lessons)
- .planning/PROJECT.md (v1.1 milestone context)

**Domain Knowledge (MEDIUM-HIGH confidence):**
- [Under the Hood of an Event-Driven "Workflow As Code" Engine](https://gillesbarbier.medium.com/under-the-hood-of-a-workflow-as-code-event-driven-engine-6107dab9b87c)
- [Mastering Event-Driven Systems: Common Pitfalls](https://dev.to/chandrasekar_jayabharathy/mastering-event-driven-systems-my-perspective-on-common-pitfalls-12e4)
- [Error Handling in Event-Driven Architecture - GeeksforGeeks](https://www.geeksforgeeks.org/system-design/error-handling-in-event-driven-architecture/)
- [Event-Driven Microservices Architecture Part III](https://medium.com/@programmingwithpr/event-driven-microservices-architecture-part-iii-6e2c702c2097)
- [Temporal: Idempotency and Durable Execution](https://temporal.io/blog/idempotency-and-durable-execution)
- [Good Practices for Writing Temporal Workflows and Activities](https://raphaelbeamonte.com/posts/good-practices-for-writing-temporal-workflows-and-activities/)
- [What Is Event-Driven Architecture? Comprehensive Guide 2026](https://estuary.dev/blog/event-driven-architecture/)
- [Event-Driven APIs: Designing for Real-Time - API7.ai](https://api7.ai/learning-center/api-101/event-driven-api-design-real-time)
- [n8n Orchestration with Retries: Idempotent Workflows That Heal Themselves](https://medium.com/@komalbaparmar007/n8n-orchestration-with-retries-idempotent-workflows-that-heal-themselves-f47b4e467ed4)

**Evented Workflow Patterns (MEDIUM confidence from v1.0):**
- Error serialization patterns from v1.0 (hydrateSerializedStepErrors)
- State isolation patterns from v1.0 (state in stepResults.__state)
- Event ordering considerations from v1.0 (stepResults as source of truth)
- At-least-once delivery from v1.0 (idempotency via status checks)

---

_Pitfalls research: 2026-01-27_
