# Resource-Scoped Observational Memory Architecture

## Overview

This document describes the architecture for resource-scoped Observational Memory (OM), where a single pool of observations is shared across all threads belonging to a resource (e.g., a user). This enables cross-thread memory - facts learned in Thread A are available in Thread B.

## Core Principles

1. **Single observation pool** - One active OM record per resource, containing observations from ALL threads
2. **Thread attribution** - Observations are tagged with their source thread ID
3. **No lost information** - Unobserved messages from other threads are included in context
4. **Thread-specific metadata on thread records** - `currentTask` and `suggestedResponse` live on thread records, not the OM record
5. **Single cursor** - One `lastObservedAt` timestamp for the entire resource

## Data Model

### ObservationalMemoryRecord (One Active Per Resource)

```typescript
{
  id: string
  resourceId: string
  threadId: null  // Always null for resource scope
  scope: 'resource'
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
  lastObservedAt: Date          // Single cursor for ALL threads
  
  // Observations with thread attribution
  // Contains <thread id="...">...</thread> sections
  activeObservations: string
  
  // Generation type (previous generation derived by sorting createdAt)
  originType: 'initial' | 'reflection'
  
  // Token tracking
  observationTokenCount: number
  totalTokensObserved: number
  
  // State flags
  isObserving: boolean
  isReflecting: boolean
  
  // Extensible metadata (app-specific)
  metadata?: Record<string, unknown>
}
```

**Derived values (no storage needed):**
- `reflectionCount` → count records with `originType: 'reflection'`
- `lastReflectionAt` → `createdAt` of most recent reflection record
- `previousGeneration` → record with next-oldest `createdAt`
```

### Thread Record (Mastra's Existing Storage)

```typescript
{
  threadId: string
  resourceId: string
  
  metadata: {
    // ... other app metadata ...
    
    mastra: {
      om: {
        currentTask?: string
        suggestedResponse?: string
      }
    }
  }
}
```

### Why Thread Metadata Lives on Thread Records

- **Bounded growth** - OM record doesn't accumulate per-thread data forever
- **Natural lifecycle** - Metadata deleted when thread is deleted
- **No cleanup logic** - Don't need to decide when to prune old thread metadata
- **Scalable** - Works with 1000+ threads without bloating OM record

## Context Window Structure

When the Actor receives context in Thread B:

```
┌─────────────────────────────────────────────────────────────┐
│ System Instructions                                         │
├─────────────────────────────────────────────────────────────┤
│ <observations>                                              │
│   <thread id="thread-a-uuid">                               │
│     - User prefers dark mode                                │
│     - Working on Mastra project                             │
│   </thread>                                                 │
│   <thread id="thread-b-uuid">                               │
│     - Debugging authentication flow                         │
│   </thread>                                                 │
│ </observations>                                             │
│                                                             │
│ <unobserved-context thread="thread-a-uuid">                 │
│   [2025-12-30 14:23] user: "actually let's use OAuth"       │
│   [2025-12-30 14:24] assistant: "good idea, updating plan"  │
│ </unobserved-context>                                       │
│                                                             │
│ <current-task>Working on JWT implementation</current-task>  │
│ <suggested-response>...</suggested-response>                │
├─────────────────────────────────────────────────────────────┤
│ [Thread B's unobserved messages - normal message history]   │
│ [2025-12-30 15:10] user: "how's the auth going?"            │
│ [2025-12-30 15:11] assistant: "..."                         │
└─────────────────────────────────────────────────────────────┘
```

### Key Points

- **Observations** are shared across all threads, with thread attribution
- **Unobserved messages from other threads** appear in `<unobserved-context>` blocks
- **Current thread's unobserved messages** appear in normal message history
- **`currentTask` and `suggestedResponse`** are loaded from current thread's metadata

## Message Loading

### Query Strategy

Single query to load all unobserved messages for the resource:

```typescript
const unobservedMessages = await storage.listMessages({
  resourceId,
  dateRange: { start: record.metadata.lastObservedAt }
});

// Group by thread at runtime
const byThread = groupBy(unobservedMessages, 'threadId');

// Current thread → message history
// Other threads → <unobserved-context> blocks in system prompt
```

### Why Single Cursor Works

- `lastObservedAt` represents when we last observed ANY thread for this resource
- All messages after this timestamp are unobserved (from any thread)
- Grouping by threadId happens at runtime, not in the query
- New threads (never observed) naturally have all their messages included

## Observation Flow

### When Observation is Triggered

1. User sends message in Thread B
2. Load active OM record for resource
3. Query all messages after `lastObservedAt`
4. Group by threadId, calculate total context size
5. **If over threshold:**
   - Acquire resource lock
   - Re-check if still over threshold (another request may have observed)
   - If still over: observe threads one at a time
   - Release lock
6. Format context window and proceed

### Observation Order

Observe threads from **oldest unobserved messages first** to **most recent**:

```typescript
// Sort threads by their oldest unobserved message
const threadOrder = Object.entries(byThread)
  .map(([threadId, messages]) => ({
    threadId,
    oldestMessage: Math.min(...messages.map(m => m.createdAt))
  }))
  .sort((a, b) => a.oldestMessage - b.oldestMessage);

// Observe in order until under threshold
for (const { threadId } of threadOrder) {
  if (isUnderThreshold()) break;
  await observeThread(threadId, byThread[threadId]);
}
```

### Why Oldest First?

- Ensures no thread's messages are "stuck" unobserved forever
- If user abandons Thread A and only uses Thread B, Thread A still gets observed
- Prevents information loss from inactive threads

### Single Thread Observation

When observing Thread X, the Observer sees the **full context** as if Thread X were the active thread:

```typescript
async function observeThread(threadId: string, messages: Message[]) {
  // 1. Build context window as if this thread were active
  //    - Full observation pool (all threads' observations)
  //    - Unobserved messages from THIS thread only
  //    - NO unobserved messages from other threads
  const prompt = buildObserverPrompt({
    allObservations: record.activeObservations,  // Full pool
    newMessages: messages,                        // This thread's unobserved messages
    threadId,                                     // For context
  });
  
  // 2. Call observer
  const result = await observerAgent.generate(prompt);
  
  // 3. Parse and wrap with thread attribution
  const parsed = parseObserverOutput(result);
  const attributed = `<thread id="${threadId}">\n${parsed.observations}\n</thread>`;
  
  // 4. Replace thread section in observations
  //    (or append if this thread has no section yet)
  record.activeObservations = replaceOrAppendThreadSection(
    record.activeObservations,
    threadId,
    attributed
  );
  
  // 5. Update thread metadata
  await storage.updateThreadMetadata(threadId, {
    'mastra.om.currentTask': parsed.currentTask,
    'mastra.om.suggestedResponse': parsed.suggestedResponse,
  });
}
```

### After All Observations Complete

```typescript
// Update the single cursor to now
record.metadata.lastObservedAt = new Date();
await storage.updateObservationalMemory(record);
```

## Resource Locking

### Why Locking is Needed

Two threads active simultaneously could both:
1. Detect threshold exceeded
2. Start observing the same threads
3. Overwrite each other's work

### Lock Behavior

```typescript
async function maybeObserve(resourceId: string) {
  // Quick check without lock
  if (!isOverThreshold()) return;
  
  // Acquire lock (blocks if another request has it)
  await storage.acquireResourceLock(resourceId);
  
  try {
    // Re-check after acquiring lock
    // Another request may have already observed!
    await reloadRecord();
    if (!isOverThreshold()) return;
    
    // Safe to observe
    await observeThreads();
  } finally {
    await storage.releaseResourceLock(resourceId);
  }
}
```

### Lock Implementation Options

1. **Database advisory locks** (Postgres: `pg_advisory_lock`)
2. **Row-level locking** (`SELECT FOR UPDATE`)
3. **Optimistic locking** with version numbers
4. **In-memory lock** (single-instance only)

For v1, we'll use optimistic locking with a version/timestamp check.

## Reflection Flow

### The Rule: Reflection Requires Zero Unobserved Messages

Reflection can ONLY happen when there are **zero unobserved messages**. This is because:

1. Every thread must be observed to extract its `currentTask`/`suggestedResponse`
2. Reflection only compresses observations (not messages)
3. By the time we reflect, all messages have been converted to observations

### Complete Observation → Reflection Sequence

```typescript
// Step 1: Observe ALL threads (no skipping, no early exit)
for (const thread of threadsWithUnobservedMessages) {
  await observeThread(thread);  // Extracts currentTask/suggestedResponse
}

// Step 2: Update cursor AFTER all threads observed
record.lastObservedAt = new Date();
await storage.updateObservationalMemory(record);

// Step 3: THEN check if reflection needed
if (record.observationTokenCount > reflectionThreshold) {
  await reflect(record);
}
```

### Reflection Process

1. Call Reflector with **observations only** (no unobserved messages - they don't exist at this point)
2. Reflector consolidates, maintains thread attribution where relevant
3. **Create NEW OM record** (not update existing)
4. New record becomes active (most recent by `createdAt`)
5. Old record preserved in history chain

```typescript
async function reflect(currentRecord: ObservationalMemoryRecord) {
  const result = await reflectorAgent.generate(
    buildReflectorPrompt(currentRecord.activeObservations)
  );
  
  const now = new Date();
  
  // Create new generation (previous generation derived by sorting createdAt)
  const newRecord = await storage.createObservationalMemory({
    resourceId: currentRecord.resourceId,
    threadId: null,
    scope: 'resource',
    originType: 'reflection',
    activeObservations: result.observations,
    createdAt: now,
    updatedAt: now,
    lastObservedAt: now,
  });
  
  // newRecord is now the active one (most recent by createdAt)
}
```

### Reflector Instructions for Thread Attribution

The Reflector is instructed to:
- Maintain `<thread id="...">` sections where thread context matters
- Consolidate cross-thread facts that are stable/universal
- Preserve thread attribution for recent or context-specific observations

## Observer Agent Considerations

### Thread Tag Handling

The Observer should NOT add thread tags - we add them ourselves. To prevent the Observer from doing this:

1. **Instruct explicitly:**
   ```
   Do not add thread identifiers or thread IDs to observations.
   Thread attribution is handled externally by the system.
   ```

2. **Parse and strip (defense in depth):**
   ```typescript
   function stripThreadTags(observations: string): string {
     // Remove any <thread...> tags the Observer might add
     return observations.replace(/<thread[^>]*>|<\/thread>/gi, '');
   }
   ```

### Observer Prompt for Cross-Thread Context

When observing Thread A, the Observer sees:
- **All observations** (full pool with all thread sections)
- **New messages from Thread A only** (not other threads' unobserved messages)

This allows the Observer to:
- Avoid duplicating facts already in other thread sections
- Make cross-thread connections
- Know what's already known vs. what's new from this thread

## Thread Alias System (Future Enhancement)

Currently using raw UUIDs for thread IDs. Future enhancement:

```typescript
// Generate readable aliases at runtime
const threadAliases = new Map<string, string>();
let aliasCounter = 1;

function getThreadAlias(threadId: string): string {
  if (!threadAliases.has(threadId)) {
    threadAliases.set(threadId, `thread-${aliasCounter++}`);
  }
  return threadAliases.get(threadId)!;
}
```

For v1, we use full UUIDs and revisit this for readability later.

## Edge Cases

### New Thread (Never Observed)

1. Thread C created, user sends first message
2. Query returns Thread C's messages (no cursor filter applies to new threads)
3. Thread C has no `<thread id="C">` section in observations yet
4. If threshold exceeded, Thread C gets observed
5. New section created: `<thread id="C">...</thread>`

### Stale Threads

Thread A inactive for weeks, has unobserved messages:
- Messages still included in query (after `lastObservedAt`)
- Thread A observed when threshold exceeded (oldest first)
- No special handling needed for v1
- Future: background task to observe stale threads proactively

### Failed Observation Mid-Way

Observing threads [A, B, C], B fails:
- A already observed (its section updated)
- B and C still have unobserved messages
- `lastObservedAt` NOT updated (only update after ALL complete)
- Next request retries from current state
- Partial progress preserved, no rollback needed

### Many Threads with Unobserved Messages

20 threads × 10 unobserved messages = 200 messages total.

**This is handled naturally by the observation loop:**
- We observe threads one-by-one (oldest first)
- After each observation, messages are converted to observations
- Loop continues until unobserved messages are under threshold
- The Actor never sees all 200 messages at once

The observation loop IS the mitigation for context explosion.

## Migration / Compatibility

### Per-Thread to Per-Resource Switching

No migration needed. When switching modes:
- Per-thread: Each thread has its own OM record
- Per-resource: Single shared OM record

The code paths are the same - per-thread is just per-resource with N=1 threads.

### Existing Per-Thread Records

If switching an existing resource from per-thread to per-resource:
- Old per-thread records remain (historical)
- New per-resource record created
- Could optionally merge old observations (future enhancement)

## Implementation Checklist

### Phase 1: Core Architecture

- [ ] Update `ObservationalMemoryRecord` type (remove per-thread fields)
- [ ] Add thread metadata storage (`metadata.mastra.om`)
- [ ] Implement single-cursor message loading
- [ ] Implement thread grouping at runtime
- [ ] Update context window formatting with `<unobserved-context>` blocks

### Phase 2: Observation Flow

- [ ] Implement oldest-first thread observation ordering
- [ ] Implement single-thread observation with attribution
- [ ] Update `lastObservedAt` only after all threads observed
- [ ] Add thread tag stripping from Observer output

### Phase 3: Locking

- [ ] Implement resource lock acquisition
- [ ] Implement re-check after lock acquired
- [ ] Add lock release in finally block

### Phase 4: Reflection

- [ ] Update Reflector prompt for thread attribution
- [ ] Ensure reflection only triggers after all observations
- [ ] Verify new record creation on reflection

### Phase 5: Thread Metadata

- [ ] Implement thread metadata read/write
- [ ] Load `currentTask`/`suggestedResponse` from thread record
- [ ] Update thread metadata after observation

### Phase 6: Testing

- [ ] Unit tests for thread grouping
- [ ] Unit tests for observation ordering
- [ ] Integration tests for cross-thread memory
- [ ] Integration tests for locking behavior
- [ ] E2E test with LongMemEval benchmark

## Open Questions (Deferred)

1. **Thread aliases** - Use readable names instead of UUIDs?
2. **Pagination** - Handle resources with very large message histories?
3. **Background observation** - Proactively observe stale threads?
4. **Observation batching** - Observe multiple threads in one LLM call?
