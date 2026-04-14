# Observational Memory: Real Primitives

## What can someone want to do with OM?

Think about this from the perspective of different callers:

### The agent loop (processor)

- "Before the LLM call, give me the context" → get observations + unobserved messages
- "Between steps, check if we should observe" → get status (token counts, thresholds)
- "Observe now — we hit the threshold" → trigger observation
- "Pre-compute observations in the background" → trigger buffered observation
- "Activate the buffered chunks" → activate
- "After the response, save final state" → save messages, cleanup

### A programmatic user (AI SDK, custom code)

- "Get the context for my LLM call" → get observations + unobserved messages
- "I just had a conversation, compress it" → observe
- "Check how much has accumulated" → get status

### A background job (cron, queue worker, webhook)

- "Process any threads that have accumulated enough messages" → observe (for a thread)
- "Pre-compute observations for threads approaching threshold" → buffer
- "Activate any buffered chunks that are ready" → activate
- "Run reflection on threads with enough observations" → reflect
- "Check which threads need attention" → get status (across threads)

### A dashboard / monitoring tool

- "Show me the status of all threads" → get status
- "Show me the observations for a thread" → get observations/record
- "Force an observation" → observe (override threshold)
- "Clear observations" → clear

## The actual primitives

### Read operations (no side effects)

1. **getStatus** — token counts, thresholds, whether buffered chunks exist, whether observation is needed
2. **getRecord** — the full OM record (observations, generation, metadata)
3. **getContext / buildContextSystemMessage** — formatted observations for LLM context

### Write operations

4. **observe** — run the observer LLM on unobserved messages, update active observations
5. **buffer** — run the observer LLM on a subset of messages, store result as a pending chunk
6. **activate** — merge buffered chunks into active observations (fast, no LLM call)
7. **reflect** — run the reflector LLM on observations, create new generation
8. **clear** — delete observations

## Key insight: buffer, activate, observe are separate operations

The current code conflates these into `observe()`, `observeWithActivation()`,
`triggerAsyncBuffering()`, etc. But they're fundamentally different:

- **buffer** creates pending chunks (calls observer LLM on a subset)
- **activate** merges pending chunks into active (no LLM call, just storage swap)
- **observe** creates active observations directly (calls observer LLM on everything)

They compose:

- Simple flow: `observe()` when threshold is met
- Buffered flow: `buffer()` multiple times as messages accumulate → `activate()` when threshold is met
- Hybrid: `buffer()` → `activate()` → `observe()` on any remaining un-buffered messages

Who calls them is up to the caller:

- The processor calls them from the agent loop
- A cron job calls them on a schedule
- A user calls them explicitly
- AI SDK hooks call them between steps

## What about the process-local state?

With separate primitives, the 5 static Maps become unnecessary:

- **asyncBufferingOps** → not needed. `buffer()` is awaitable, not fire-and-forget.
  If you want background buffering, put `buffer()` in a job queue.
- **lastBufferedBoundary** → not needed. `getStatus()` reads from storage to
  determine if buffering should trigger.
- **lastBufferedAtTime** → already in storage (`lastBufferedAtTime` on the record)
- **sealedMessageIds** → not needed. Sealing exists because fire-and-forget
  buffering runs alongside streaming. If `buffer()` is called after messages
  are finalized, there's nothing to seal.
- **reflectionBufferCycleIds** → same as asyncBufferingOps for reflection.

## API sketch

```ts
class ObservationalMemory {
  // ── Read ────────────────────────────────────

  getStatus(
    threadId,
    resourceId?,
  ): Promise<{
    record: ObservationalMemoryRecord;
    pendingTokens: number;
    threshold: number;
    shouldObserve: boolean;
    bufferedChunks: number;
    bufferedTokens: number;
  }>;

  getRecord(threadId, resourceId?): Promise<ObservationalMemoryRecord | null>;

  buildContextSystemMessage(threadId, resourceId?): Promise<string | undefined>;

  getObservations(threadId, resourceId?): Promise<string | undefined>;

  getHistory(threadId, resourceId?): Promise<ObservationalMemoryRecord[]>;

  // ── Write ───────────────────────────────────

  observe(
    threadId,
    resourceId?,
    opts?,
  ): Promise<{
    observed: boolean;
    reflected: boolean;
    record: ObservationalMemoryRecord;
  }>;
  // The "simple" API. Loads messages from storage, checks threshold,
  // calls observer, updates record. Optionally triggers reflection.
  // Does NOT buffer. Does NOT activate. Just observes.

  buffer(
    threadId,
    resourceId?,
  ): Promise<{
    buffered: boolean;
    record: ObservationalMemoryRecord;
  }>;
  // Pre-compute observations on accumulated messages.
  // Stores result as a pending chunk in storage.
  // Returns quickly — still calls observer LLM but on smaller batches.
  // Idempotent: won't re-buffer already-buffered messages.

  activate(
    threadId,
    resourceId?,
  ): Promise<{
    activated: boolean;
    chunksActivated: number;
    record: ObservationalMemoryRecord;
  }>;
  // Merge buffered chunks into active observations.
  // No LLM call — just a storage swap.
  // Fast. Can be called frequently.
  // Idempotent: no-op if no chunks or below activation threshold.

  reflect(
    threadId,
    resourceId?,
    opts?,
  ): Promise<{
    reflected: boolean;
    record: ObservationalMemoryRecord;
  }>;
  // Compress observations into a new generation.
  // Checks reflection threshold. Calls reflector LLM.

  clear(threadId, resourceId?): Promise<void>;
  // Delete all observations for this thread.
}
```

## Usage examples

### Simple (post-response)

```ts
const ctx = await memory.getContext({ threadId });
const result = await generateText({ system: ctx.systemMessage, messages: ctx.messages });
await memory.saveMessages({ ... });
await om.observe(threadId);
```

### With buffering (cron job / background worker)

```ts
// Runs periodically for active threads
const status = await om.getStatus(threadId);

if (status.pendingTokens >= status.threshold) {
  // Threshold met — activate buffered chunks + observe remainder
  const { activated } = await om.activate(threadId);
  await om.observe(threadId);
} else if (status.pendingTokens >= bufferInterval) {
  // Not at threshold yet, but enough to pre-compute
  await om.buffer(threadId);
}
```

### With buffering (AI SDK multi-step)

```ts
const ctx = await memory.getContext({ threadId });
const result = await generateText({
  maxSteps: 10,
  system: ctx.systemMessage,
  messages: ctx.messages,

  async onStepFinish({ stepNumber }) {
    await memory.saveMessages({ ... });

    // Check if we should buffer between steps
    const status = await om.getStatus(threadId);
    if (status.shouldObserve) {
      await om.activate(threadId);  // fast
      await om.observe(threadId);   // may be fast if activation handled most
    } else if (needsBuffering(status)) {
      await om.buffer(threadId);  // blocks this step, but pre-computes for later
    }
  },
});

await om.observe(threadId); // final observation
```

### Dashboard / admin

```ts
// Force observation regardless of threshold
await om.observe(threadId, undefined, { force: true });

// Check status
const status = await om.getStatus(threadId);
console.log(`Pending: ${status.pendingTokens}/${status.threshold}`);
console.log(`Buffered chunks: ${status.bufferedChunks}`);
```

## What about the processor?

The processor would use these same primitives:

- Step 0: `memory.getContext()` → add to MessageList → `om.activate()` → `om.getStatus()`
- Step N: `om.getStatus()` → maybe `om.buffer()` → if threshold met: `om.activate()` + `om.observe()`
- After: `om.observe()`

The processor adds the MessageList ↔ storage sync layer and progress streaming,
but the core OM operations are the same primitives everyone uses.
