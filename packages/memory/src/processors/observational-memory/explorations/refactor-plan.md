# OM/Processor Refactor Plan

## Goal

Make the processor and AI SDK examples use the same public OM primitives.
Remove processor-specific methods from the OM class.
Ensure the AI SDK demo is thorough enough to be a real reference implementation.

---

## Completed

### Cleanup seam

- `cleanupMessages()` is now the shared cleanup primitive
- Both processor and AI SDK demo use it

### Observe seam

- Removed `observeWithActivation()` from OM
- Processor now composes: `waitForBuffering` → `getStatus` → `activate` → `observe` → `reflect`
- Removed `tryStep0Activation()` — processor calls `activate({ checkThreshold })` + `resetBufferingState` + reflect check
- Removed `maybeStep0Reflect()` — processor calls `getStatus().shouldReflect` + `reflect()`

### Dead code removal

- Removed `tryActivateBufferedObservations`, `maybeAsyncReflect`, `shouldTriggerAsyncReflection`
- Removed `refreshBufferedChunkMessageTokens`, `hasUnobservedParts`, `injectObservationsIntoMessages`, `loadHistory`
- Cleaned up dead imports

### Status API unification

- Unified `getObservationStatus` into `getStatus` (single method with all fields)
- Moved stale boundary reset into `activate()`

---

## Current State: Processor vs AI SDK Demo

### Lifecycle Comparison

```text
                    PROCESSOR                          AI SDK DEMO
                    ─────────                          ───────────

 ┌─ INIT ──────────────────────────────┐  ┌─ INIT ─────────────────────────────┐
 │ memory.getContext()                  │  │ memory.getContext()                 │
 │ load messages into MessageList      │  │ load messages into MessageList      │
 │ cache otherThreadsContext           │  │                                     │
 └─────────────────────────────────────┘  └─────────────────────────────────────┘
                  SAME                                  SAME

 ┌─ STEP 0: ACTIVATE ─────────────────┐  ┌─ prepareStep (step > 0) ────────────┐
 │ activate({ checkThreshold: true })  │  │ getStatus()                         │
 │ if activated:                       │  │ if canActivate:                     │
 │   removeByIds(activatedMessageIds)  │  │   activate({ checkThreshold: true })│
 │   resetBufferingState()             │  │                                     │
 │ getStatus() → maybe reflect()       │  │ buildContextSystemMessage()         │
 │                                     │  │ cleanupMessages()                   │
 └─────────────────────────────────────┘  └─────────────────────────────────────┘
      ▲ removeByIds + resetBuffering          ▲ no removeByIds
      ▲ reflect check                         ▲ no resetBuffering
      ▲ runs at step 0 only                   ▲ no reflect check
                                              ▲ runs at step > 0
                                              ▲ does cleanup + system msg rebuild

 ┌─ STEP 2: STATUS + BUFFER/OBSERVE ──┐  ┌─ onStepFinish ──────────────────────┐
 │ getStatus()                         │  │ getStatus()                         │
 │ if shouldBuffer:                    │  │ if shouldBuffer:                    │
 │   buffer() [fire-and-forget]        │  │   buffer() [fire-and-forget]        │
 │     + beforeBuffer sealing callback │  │                                     │
 │ if stepNumber > 0 && shouldObserve: │  │ if shouldObserve:                   │
 │   saveIncrementalMessages()         │  │   awaitBuffering()                  │
 │   runThresholdObservation():        │  │   if canActivate: activate()        │
 │     waitForBuffering()              │  │   observe()                         │
 │     getStatus() [re-check]          │  │                                     │
 │     if canActivate: activate()      │  │                                     │
 │     blockAfter check                │  │                                     │
 │     observe()                       │  │                                     │
 │   applyThresholdObservationSuccess: │  │                                     │
 │     cleanupMessages()               │  │                                     │
 │     resetBufferingState()           │  │                                     │
 └─────────────────────────────────────┘  └─────────────────────────────────────┘
      ▲ beforeBuffer sealing                  ▲ no sealing callback
      ▲ incremental message save              ▲ no incremental save
      ▲ fresh re-check after wait             ▲ no re-check
      ▲ blockAfter gate                       ▲ no blockAfter
      ▲ cleanup + reset after observe         ▲ no cleanup after observe
      ▲ skip at step 0                        ▲ runs every step

 ┌─ STEP 3: INJECT OBSERVATIONS ──────┐
 │ buildContextSystemMessage()         │  (done in prepareStep above)
 │ addSystem()                         │
 │ add continuation message            │
 │ filterObservedMessages()            │
 └─────────────────────────────────────┘

 ┌─ STEP 4: PROGRESS + TOKENS ────────┐
 │ emitProgress()                      │  (no equivalent — processor-specific)
 │ countMessageTokensAsync()           │
 │ savePendingTokens()                 │
 └─────────────────────────────────────┘

 ┌─ OUTPUT: SAVE ─────────────────────┐  ┌─ POST-STREAM ────────────────────────┐
 │ saveFinalMessages()                 │  │ memory.saveMessages()                │
 │                                     │  │ om.finalize()                        │
 └─────────────────────────────────────┘  └─────────────────────────────────────┘
```

### Key Differences

| #   | Difference                               | Processor                                       | AI SDK Demo               | Category            |
| --- | ---------------------------------------- | ----------------------------------------------- | ------------------------- | ------------------- |
| 1   | Buffer sealing (`beforeBuffer` callback) | Yes                                             | No                        | Processor lifecycle |
| 2   | Incremental message save                 | Yes (`saveIncrementalMessages`)                 | No (saves at end)         | Processor lifecycle |
| 3   | Fresh re-check after wait                | Yes (`getStatus` after wait)                    | No (uses original status) | **Demo gap**        |
| 4   | blockAfter gate                          | Yes (defer when below blockAfter)               | No (always observes)      | **Demo gap**        |
| 5   | Cleanup after observation                | Yes (`cleanupMessages` + `resetBufferingState`) | Only in prepareStep       | **Demo gap**        |
| 6   | removeByIds after activation             | Yes                                             | No                        | **Demo gap**        |
| 7   | resetBufferingState after activation     | Yes                                             | No                        | **Demo gap**        |
| 8   | Reflection check after activation        | Yes (`shouldReflect` → `reflect()`)             | No                        | **Demo gap**        |
| 9   | System msg injection + continuation hint | Inline in processInputStep                      | Via prepareStep return    | Structural          |
| 10  | Progress emission + token persistence    | Yes (`emitProgress`, `savePendingTokens`)       | No                        | Processor-specific  |
| 11  | `finalize()` at end                      | No (handles inline)                             | Yes                       | Demo-specific       |

---

## Remaining Phases

### Phase 1: Expand AI SDK demo to be thorough

Make the production demo a real reference implementation. 5 changes, all using existing public primitives:

**onStepFinish observe path:**

```
CURRENT:                              TARGET:
  awaitBuffering()                      awaitBuffering()
  if canActivate: activate()            getStatus()  ← fresh re-check
  observe()                             if !shouldObserve: bail
                                        if canActivate:
                                          activate()
                                          removeByIds()         ← new
                                          resetBufferingState() ← new
                                        blockAfter check        ← new
                                        observe()
                                        cleanupMessages()       ← new
```

**prepareStep activation path:**

```
CURRENT:                              TARGET:
  if canActivate:                       if canActivate:
    activate({ checkThreshold })          activate({ checkThreshold })
                                          removeByIds()           ← new
                                          resetBufferingState()   ← new
                                        if shouldReflect:         ← new
                                          reflect()
  buildContextSystemMessage()           buildContextSystemMessage()
  cleanupMessages()                     cleanupMessages()
```

### Phase 2: Move processor-only methods out of OM

These methods are only called by the processor (not by AI SDK demo or internal OM code).
Moving them shrinks OM's public surface to just the shared primitives.

| Method                    | Current Location | Move To                            | Why                                  |
| ------------------------- | ---------------- | ---------------------------------- | ------------------------------------ |
| `saveIncrementalMessages` | OM               | processor or MemoryContextProvider | Message persistence lifecycle        |
| `saveFinalMessages`       | OM               | processor or MemoryContextProvider | Message persistence lifecycle        |
| `emitProgress`            | OM               | processor                          | UI streaming markers                 |
| `savePendingTokens`       | OM               | processor                          | Token state tracking                 |
| `getSealedIds`            | OM               | processor                          | Sealed ID tracking                   |
| `countMessageTokensAsync` | OM               | processor                          | Only used for token persistence step |
| `countStringTokens`       | OM               | processor                          | Only used for token persistence step |
| `filterObservedMessages`  | OM               | processor                          | Demo uses `cleanupMessages` instead  |

**Note:** `sealMessagesForBuffering` has internal OM callers (in `buffer()` and `doAsyncBufferedObservation`) and stays on OM.

```
┌─ OM CLASS (after Phase 2) ───────────────────────────────┐
│                                                           │
│  SHARED PRIMITIVES (used by processor + AI SDK):          │
│    getStatus()         activate()        observe()        │
│    reflect()           buffer()          finalize()       │
│    waitForBuffering()  cleanupMessages()                  │
│    resetBufferingState()                                  │
│    buildContextSystemMessage()                            │
│    getUnobservedMessages()                                │
│    getOrCreateRecord()   getRecord()                      │
│    getObservationConfig()  getResolvedConfig()            │
│                                                           │
│  INTERNAL (used by primitives above):                     │
│    tokenCounter, storage, locks, static maps, etc.        │
│                                                           │
└───────────────────────────────────────────────────────────┘

┌─ PROCESSOR (after Phase 2) ──────────────────────────────┐
│                                                           │
│  MOVED FROM OM (processor-specific lifecycle):            │
│    saveIncrementalMessages()                              │
│    saveFinalMessages()                                    │
│    emitProgress()                                         │
│    savePendingTokens()                                    │
│    getSealedIds()                                         │
│    countMessageTokensAsync()                              │
│    countStringTokens()                                    │
│    filterObservedMessages()                               │
│                                                           │
│  ORCHESTRATION (already here):                            │
│    runThresholdObservation()                              │
│    applyThresholdObservationSuccess()                     │
│    processInputStep()                                     │
│    processOutputResult()                                  │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Phase 3: Investigate filterObservedMessages vs cleanupMessages

Both do marker-boundary pruning + observed-ID removal. Key differences:

| Aspect          | filterObservedMessages   | cleanupMessages          |
| --------------- | ------------------------ | ------------------------ |
| When            | Step 0 context filtering | Post-observation cleanup |
| Retention floor | No                       | Yes                      |
| Message saving  | No                       | Yes (sealed ID tracking) |
| Cursor fallback | Yes (thread metadata)    | No                       |
| Used by         | Processor only           | Both processor + demo    |

Could potentially:

- Unify into one method with options
- Or make `filterObservedMessages` processor-private after Phase 2

---

## Target: Shared Core Flow

After all phases, both processor and AI SDK demo use the same core observation flow:

```
getStatus()
├─ shouldBuffer → buffer() [fire-and-forget]
├─ shouldObserve:
│    waitForBuffering()
│    getStatus()           ← fresh re-check
│    if canActivate:
│      activate()
│      removeByIds()
│      resetBufferingState()
│    blockAfter check
│    observe()
│    cleanupMessages()
├─ shouldReflect → reflect()
└─ noop
```

The processor adds on top:

- `beforeBuffer` sealing callback
- `saveIncrementalMessages` / `saveFinalMessages`
- `emitProgress` / `savePendingTokens`
- `filterObservedMessages` (step 0 variant)
- Repro capture

These are processor lifecycle concerns, not OM semantics.
