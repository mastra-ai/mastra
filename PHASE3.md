# Phase 3 — Loop unification via a class-based loop builder

One place for agent-loop behavior so a fix lands once, without complicating the
main loop's hot path. This revision restructures the plan around a **class
implementation of the loop**: a concrete `AgenticLoopBuilder` base class whose
methods construct the workflow topology and each step; the durable loop becomes
a subclass that overrides narrow, designated hooks. The anatomy, divergence
ledger, and worked examples from the previous revision are retained — they now
describe what goes *into* the class and what stays a subclass override.

## Loop anatomy — what the thing actually is

Both loops compile to the **same workflow topology** (verified against
`loop/workflows/agentic-loop/index.ts` + `agentic-execution/index.ts` and
`durable/workflows/create-durable-agentic-workflow.ts`):

```
'agentic-loop' (outer workflow)
└─ .dowhile( one-iteration workflow, CONTINUE? )
     │
     ▼  one iteration ('agentic-execution' / AGENTIC_EXECUTION):
     ①  input mapping          durable: .map(map-to-llm-input) · main: schema passthrough
     ②  llm-execution          stream the model, emit chunks, collect toolCalls/usage
     ③  extract tool calls     .map → array for foreach            (both)
     ④  tool-call (foreach)    per call: approval gate, suspension, background
                               dispatch, execute, onOutput hook
     ⑤  llm-mapping            fold tool results into transcript; emission ordering
     ⑥  background-task-check  poll pending bg tasks, inject results/prompts
     ⑦  signal-drain           inject user signals queued during the iteration
     ⑧  state update           durable: .map(update-iteration-state) · main: passthrough
     ⑨  is-task-complete       completion-scorer policy (no-op unless configured)
     ⑩  goal                   objective judge (no-op unless configured)
     │
     CONTINUE? predicate       abort check · feedback-stop two-phase · isContinued ·
                               maxSteps · stopWhen · resume seal-and-rotate (#19445,
                               main only) · a SECOND inline signal drain
```

Step sequence and order are identical — ①–⑩ mirror one-to-one, durable merely
inserts `.map()` glue where state must be reshaped across its serialization
boundary. Every difference between the loops lives in one of **three planes**:

| plane | main loop | durable loop | converge? |
|---|---|---|---|
| **Behavior** — decisions, guards, ordering, transcript mutations | inline in step bodies + predicate | re-implemented inline, "Mirror the regular agent" comments | **YES — becomes base-class step methods** |
| **State** — how loop state travels | closure vars + RunScope + live `MessageList` | serialized `IterationState` + `globalRunRegistry` + `messageListState` | no — subclass hook (`resolveRuntime` / glue maps) |
| **Transport** — how chunks leave | `controller.enqueue` / `safeEnqueue` | `emitChunkEvent(pubsub, runId, …)` | no — subclass hook (`emitChunk`) |

The state plane difference is starkest at loop level:

| loop-level state | main | durable |
|---|---|---|
| accumulated steps / content cursor | closure vars `accumulatedSteps`, `previousContentLength` | `state.accumulatedSteps`, `state.iterationCount` (serialized, survives restart) |
| feedback two-phase stop | closure `pendingFeedbackStop` | `state.pendingFeedbackStop` |
| resume continuation (#19445) | closure `isResumeContinuationPending` | **absent** (ledger L10) |
| stopWhen predicate | closure param | registry entry (closures can't cross the wire) |

**What's shared today vs what should be, per part:**

| part | shared today (`loop/shared` + cross-imports) | duplicated — should live once in the base class |
|---|---|---|
| ② llm-execution | prompt assembly (`build-llm-prompt-args`, `merge-llm-call-headers`, `compose-step-input`, `inject-background-task-prompt`, `auto-resume-system-message`), `provider-tool-spans`, `build-messages-from-chunks` | chunk pipeline: payload transform, client-tool observability, #22273 content guard, step-start/finish ordering decisions |
| ④ tool-call | `tool-call-concurrency`, `provider-tool-spans`, `normalizeModelOutput` (via reverse import) | bg-dispatch ladder (#22363), execute+onOutput, approval-decline handling, error policy |
| ⑤ llm-mapping | `build-messages-from-chunks` (partially) | fold + emission-ordering logic (main 752 ln vs durable 386 ln) |
| ⑥⑦⑨⑩ small steps | `loop/network/validation` (goal / is-task-complete judging) | entire step decision bodies |
| CONTINUE? predicate | **nothing** | the whole continuation decision: feedback two-phase, stopWhen, maxSteps, isContinued, #19445 rotation |
| snapshots | `prune-snapshot` | — |

What's actually shared today is the **input side** of llm-execution (prompt
assembly) plus a few stream-folding helpers. Nearly everything in the
**decision** column — the region bug fixes touch — is duplicated. The refactor
in one sentence: *move the right-hand column into base-class methods that both
loops execute.*

## The design — `AgenticLoopBuilder`

### Shape

A **concrete base class** whose behavior IS the regular agent loop, plus a
durable subclass that overrides only designated hooks (per the state/transport
planes above). Template-method pattern: the base owns topology and step
construction; subclasses own plumbing.

```
AgenticLoopBuilder                    packages/core/src/loop/loop-builder.ts
│  build()                — topology template method (never overridden)
│  buildIteration()       — composes ①–⑩ (never overridden)
│  create*Step() × 8      — step factory methods: BEHAVIOR lives here, shared
│  shouldContinue()       — CONTINUE? predicate, calls continuation core
│  ── hooks (the ONLY sanctioned override surface) ──────────────────────
│  resolveRuntime(params) — state plane: how a step gets live objects
│  emitChunk(rt, chunk)   — transport plane
│  projectState(rt)       — state plane: how a step writes state back out
│  mapInput()/mapState()  — ①/⑧ glue (base: identity)
│  wrapToolExecution(fn)  — around-advice (base: identity)
│  onStepError(err, ctx)  — error policy
│  workflowFactory()      — createWorkflow (default engine)
│  snapshotOptions()      — persist policy, pruneSnapshot, tracingPolicy
│
└─ DurableAgenticLoopBuilder          agent/durable/workflows/durable-loop-builder.ts
   │  resolveRuntime  → deserialize messageListState + globalRunRegistry.get(runId)
   │  emitChunk       → emitChunkEvent(pubsub via PUBSUB_SYMBOL, runId, chunk)
   │  projectState    → messageListState = list.serialize() + IterationState fields
   │  mapInput/State  → map-to-llm-input / update-iteration-state glue
   │  wrapToolExecution → markRunActive(runId) bracketing
   │  workflowFactory → createWorkflow | createEventedWorkflow (Phase 2 engine option)
   │  snapshotOptions → durable persistence policy
   │
   └─ (later) InngestLoopBuilder — mirrors today's InngestAgent extends DurableAgent
```

Three layers, top to bottom:

1. **Topology** (`build`/`buildIteration`) — final. One definition of the
   dowhile chain; a step can never be reordered in one loop only.
2. **Step factory methods** (`createSignalDrainStep`, `createToolCallStep`, …)
   — where behavior lives, shared. Their `execute` bodies call `this.*` hooks
   for anything plane-specific.
3. **Pure cores** (`loop/shared/steps/*`) — module-level functions the step
   methods call for the densest decision logic (chunk pipeline, dispatch
   ladder, continuation). Kept as free functions, not methods, so they're
   exhaustively unit-testable without instantiating a builder.

Existing public factories become thin wrappers, so no caller changes:

```ts
// loop/workflows/agentic-loop/index.ts
export function createAgenticLoopWorkflow(params) {
  return new AgenticLoopBuilder(params).build();
}
// durable/workflows/create-durable-agentic-workflow.ts
export function createDurableAgenticWorkflow(agent, options) {
  return new DurableAgenticLoopBuilder(agent, options).build();
}
```

### What a step method looks like

```ts
// base class — behavior written ONCE
protected createSignalDrainStep() {
  return createStep({
    id: 'signal-drain', inputSchema: this.iterationSchema, outputSchema: this.iterationSchema,
    execute: async params => {
      const rt = this.resolveRuntime(params);            // hook: state plane
      const signals = rt.drainPendingSignals?.(rt.runId) ?? [];
      const drained = await drainSignalsIntoTranscript({ // pure core
        pendingSignals: signals,
        messageList: rt.messageList,
        currentMessageId: rt.currentMessageId,
        emitChunk: chunk => this.emitChunk(rt, chunk),   // hook: transport plane
      });
      return this.projectState(rt, drained);             // hook: state plane
    },
  });
}
```

The durable subclass **does not override this method**. It overrides
`resolveRuntime` (deserialize + registry lookup), `emitChunk` (pubsub), and
`projectState` (serialize) — once, for all ten steps. That is the payoff over
the previous shells design: plumbing is written once per engine instead of
once per engine *per step*, and the D3 contract split (main passes `runId`
to `drainPendingSignals`, durable binds `runId` in the registry closure and
passes only `scope`) collapses to a single normalized `LoopRuntime` signature
because the call site exists once.

### The two contracts the hooks rest on (Step 2 prerequisite)

The base step methods can only be shared if both loops agree on what flows
between steps and what a step can resolve. Two types, defined before any
hoisting starts:

- **`IterationState`** — the serializable between-steps shape. Durable already
  has this; main currently scatters it across closure vars
  (`accumulatedSteps`, `pendingFeedbackStop`, `previousContentLength`,
  `isResumeContinuationPending`). Main converges on the same *shape*, kept
  in-memory — nothing about main gets serialized, but the continuation core
  and step methods operate on one type. (This also fixes the invisibility of
  main's loop state, and gives #19445's flag a place durable can port to.)
- **`LoopRuntime`** — the resolved live view a step body needs: `messageList`,
  `tools`, `runId`, `abortSignal`, `drainPendingSignals`, `stopWhen`,
  observability handles. Base resolves it from RunScope/closures; durable
  resolves it from `globalRunRegistry` + deserialization. RunScope values
  never appear on `IterationState` (they must not cross the wire — see
  core AGENTS.md).

### Override discipline (the guardrail)

Sanctioned override surface = the hooks listed above, nothing else. If the
durable subclass needs to override an **entire step factory method**, that is
a tracked ledger item — either the behavior genuinely differs (adjudicate:
port or mark engine-specific) or the hook surface is missing a seam (fix the
seam). During migration whole-method overrides are expected and are exactly
how we measure progress: **done = the durable subclass overrides only hooks
and glue.** Enforced by review + a lint rule limiting which base members are
overridable (`override` keyword + naming convention `hook*`/glue, or an ESLint
`no-restricted-syntax` rule on the subclass file).

Known risks of the class approach, called out honestly: fragile-base-class
coupling (mitigated by the small hook surface and pure cores), and the
temptation to grow config flags on the base (forbidden — a flag on a step
method means the behavior isn't shared; it belongs in an override that gets a
ledger row).

## Worked examples — recast as class methods

### 1. signal-drain (the template)

Current: `signal-drain-step.ts` (54 ln) vs durable `signal-drain.ts` (73 ln),
line-for-line parallel behavior. Diffing surfaced three divergences:

| #   | main                              | durable                             | adjudication needed    |
| --- | --------------------------------- | ----------------------------------- | ---------------------- |
| D1  | sets `stepResult.reason: 'other'` | doesn't set `reason`                | which is correct?      |
| D2  | errors propagate                  | swallows all errors ("best-effort") | pick one policy        |
| D3  | `drainPendingSignals(runId, scope?)` | `drainFn(scope?)` — runId bound in registry closure | **not a bug** (verified: preparation.ts:734 binds runId; `drainFn('pending')` passes scope). Contract divergence only — normalize the shared `LoopRuntime.drainPendingSignals` signature during hoist |

Pure core (`loop/shared/steps/signal-drain-core.ts`, ~25 ln):

```ts
export async function drainSignalsIntoTranscript(params: {
  pendingSignals: AgentSignal[];
  messageList: MessageList;
  currentMessageId: string;
  emitChunk: (part: unknown) => void | Promise<void>;
}): Promise<{ nextMessageId: string } | null> {
  if (params.pendingSignals.length === 0) return null;
  const nextMessageId = params.messageList.rotateResponseMessageId(params.currentMessageId);
  for (const signal of params.pendingSignals) {
    const forTranscript = params.messageList.addSignal(signal);
    await params.emitChunk(forTranscript.toDataPart());
  }
  return { nextMessageId };
}
```

Base `createSignalDrainStep()` calls it (see "What a step method looks like"
above); durable's step file is deleted; D1/D2 get adjudicated once, encoded in
the base method, and can never re-diverge. Error policy: if adjudication says
the engines legitimately differ, it lives in the `onStepError` hook — not in a
flag.

### 2. tool-call background-dispatch ladder

**Research correction:** `executeDurableToolCalls`
(durable/workflows/shared/execute-tool-calls.ts) — previously flagged as "the
better core to converge on" — has **zero call sites** anywhere in the repo.
Both loops execute tools inline (durable tool-call.ts:1319, main
tool-call-step.ts:1412). Dead code; **deleted** in Step 0, not promoted.

The real convergence target is the background-dispatch ladder, a near-verbatim
copy in both files with divergent fixes:

- main tool-call-step.ts:1356-1359 has the **#22363** nullish-check fix
  (`resumeDataToPassToToolOptions != null`, with the comment about
  `false`/`0`/`''` stranding suspended tasks)
- durable tool-call.ts:1242-1243 still has the pre-fix predicate → **live
  bug** in DurableAgent/EventedAgent
- durable additionally has `checkIfRunning → bgTask.restart()` (crash
  recovery) — ledger L5
- main additionally guards emission with `safeEnqueue` — that's the base
  `emitChunk` implementation, stays in the base hook

Pure core (`loop/shared/steps/background-dispatch-core.ts`):

```ts
export async function runBackgroundDispatchLadder(params: {
  bgTask: BackgroundTaskHandle;               // engine-built, live (from LoopRuntime)
  ids: { toolCallId; toolName; runId; agentId; threadId?; resourceId? };
  resumeData: unknown;                        // #22363 nullish semantics live HERE, once
  checkPreviouslyRunning: boolean;            // durable's restart branch (pending L5)
  emitStarted: (chunk: BackgroundTaskStartedChunk) => void | Promise<void>;
}): Promise<{ kind: 'resumed' | 'restarted' | 'started'; placeholderResult: string } | { kind: 'fallback-to-sync' }>;
```

Base `createToolCallStep()` owns the ladder + `executeToolWithOnOutputHook`
(the `tool.execute` + onOutput block, duplicated at main:1412-1427 /
durable:1315-1335). Durable's `markRunActive` bracketing becomes the
`wrapToolExecution` hook; abort-aware/FGA error handling is base behavior
(adjudicating L6/L7); `toModelOutput` mapping (durable-only feature) is base
behavior gated on the mapping tool's presence — it's behavior, not plumbing.

### 3. llm-execution chunk pipeline

**Research correction #2:** "durable adopts `processOutputStream` wholesale"
is unrealistic. Durable's stream loop (llm-execution.ts:1097-1210) has
*structural* engine differences: step-finish deferral for pubsub ordering,
`emitStepStartEvent` on first chunk, `markRunActive` bracketing. The
**stream driver** therefore stays per-engine — in class terms,
`createLlmExecutionStep()` is the last method to hoist fully, and initially
hoists only its input side (prompt assembly, already shared) plus the
per-chunk semantics, which durable today mirrors by hand (four "Mirror the
regular agent" comments):

- tool-payload transform (duplicated as durable `applyToolPayloadTransformToChunk`
  vs main's local `addToolPayloadTransformToChunk` — two names, one behavior)
- client-tool observability injection + delta collection + span end
- provider-tool-call recording
- content tracking: `STEP_CONTENT_CHUNK_TYPES` / `hasStepContent` — the
  **#22273 infinite-loop guard, currently main-only**

Pure core (`loop/shared/steps/chunk-pipeline.ts`) — stateful pure processor,
no transport:

```ts
export function createChunkPipeline(deps: {
  tools: Record<string, CoreTool> | undefined;
  toolPayloadTransformPolicy?: ToolPayloadTransformPolicy;
  observability?: { startClientToolSpan; endClientToolSpan };
  logger?: IMastraLogger;
}): {
  process(rawChunk: ChunkType): Promise<{
    clientChunk: ChunkType;        // transformed copy; rawChunk untouched
    hasStepContent: boolean;       // running #22273 guard state
    deferStepFinish: boolean;      // decision only — drivers decide how to defer
    recordedProviderToolCall?: ProviderToolCallRecord;
  }>;
};
```

Both drivers call `pipeline.process(chunk)` then hand `clientChunk` to
`this.emitChunk(...)`. #22273 lands in durable as a standalone port first
(Step 0) so the later hoist stays behavior-preserving.

### 4. CONTINUE? predicate (new target surfaced by the anatomy)

Main's predicate is a ~100-line closure mixing four decisions plus an inline
signal drain; durable re-implements three of the four and is missing #19445.
In class terms this is `shouldContinue(state, rt)` on the base, backed by a
pure `evaluateLoopContinuation(state, deps) → { continue, reason,
stateUpdates }` core (`loop-continuation-core.ts`). Durable's extra abort
check (registry `abortSignal`) folds into `LoopRuntime.abortSignal` so the
base decision covers both (L12).

## Module layout after refactor

```
packages/core/src/loop/
  loop-builder.ts                       # AgenticLoopBuilder (base class)
  loop-runtime.ts                       # LoopRuntime + IterationState types
  shared/                               # THE shared layer (existing dir, formalized)
    compose-step-input.ts               # existing
    build-llm-prompt-args.ts            # existing, already dual-consumer
    merge-llm-call-headers.ts           # existing, already dual-consumer
    inject-background-task-prompt.ts    # existing
    auto-resume-system-message.ts       # existing
    normalize-model-output.ts           # MOVED from durable (kills loop→durable import)
    tool-payload-transform.ts           # MERGED from durable/utils + main's local helper
    steps/
      signal-drain-core.ts              # Step 3
      loop-continuation-core.ts         # Step 3
      background-task-check-core.ts     # Step 3
      is-task-complete-core.ts          # Step 3
      goal-core.ts                      # Step 3
      background-dispatch-core.ts       # Step 4
      execute-tool-core.ts              # Step 4
      chunk-pipeline.ts                 # Step 5

packages/core/src/agent/durable/workflows/
  durable-loop-builder.ts               # DurableAgenticLoopBuilder (hooks + glue only, end state)
```

Dependency rule, lint-enforced (`no-restricted-imports`): `loop/shared/**` and
`loop-builder.ts` import from neither `loop/workflows/**` nor
`agent/durable/**`; durable imports downward only.

Explicitly NEVER hoisted into the base as shared behavior: RunScope /
`_internal` mechanics (base hook impl detail); `globalRunRegistry` /
`messageListState` / PUBSUB_SYMBOL (durable hook impl detail); controller vs
pubsub transport; suspension flush; `markRunActive`; snapshot serialization.
If hoisting a method wants a boolean flag or a second code path, the behavior
isn't shared — it stays an override with a ledger row.

## Divergence ledger

The ledger doubles as the migration meter: after Step 1, every row corresponds
to a whole-method override in the durable subclass; done = only hook
overrides remain.

| #   | Divergence                         | Status                         | Action                                            |
| --- | ---------------------------------- | ------------------------------ | ------------------------------------------------- |
| L1  | #22363 falsy-resume predicate      | main fixed, durable buggy      | port to durable, Step 0, with test                |
| L2  | #22273 zero-output guard           | main only                      | port to durable, Step 0, with test                |
| L3  | signal-drain `reason:'other'`      | main only                      | adjudicate in Step 3                              |
| L4  | signal-drain error policy          | durable swallows, main throws  | adjudicate in Step 3 (candidate `onStepError`)    |
| L5  | bg-task `checkIfRunning→restart`   | durable only                   | port to base or keep as override, Step 4          |
| L6  | onOutput hook `abortSignal` param  | main only                      | adjudicate in Step 4                              |
| L7  | abort-aware tool error handling    | main only                      | adjudicate in Step 4                              |
| L8  | tool-payload transform helper      | two names, two files           | merge, Step 5                                     |
| L9  | `executeDurableToolCalls`          | dead code, 0 callers           | delete, Step 0                                    |
| L10 | #19445 resume seal-and-rotate      | main only (0 refs in durable)  | verify durable resume path; likely port, Step 3   |
| L11 | inline signal drain in CONTINUE?   | both, differs from step ⑦'s    | fold both call sites onto signal-drain-core, Step 3 |
| L12 | abort check in CONTINUE? predicate | durable only (registry signal) | fold into `LoopRuntime.abortSignal`, Step 3       |
| L13 | `drainPendingSignals` signature    | main: `(runId, scope?)`; durable: `(scope?)`, runId closure-bound | **not a bug** (verified) — normalize signature in `LoopRuntime`, Step 2/3 |
| L19 | step-lifecycle-chunk policy (#16687/#17370 vs #21529) | **deliberate** (C1/C2) | no port either direction; see note below |

Rows L1/L2 are why this refactor pays for itself before it's half done.
Rows L14–L18 were adjudicated inline during Step 5 hoisting (Commits M/N/O
commit messages); L18's processor-crash re-scope lives in PHASE2.md.

**L19 — step-lifecycle-chunk policy (deliberate divergence, adjudicated in
Step 6 audit).** Main and durable deliver step-lifecycle information on
different planes, by design:

- *Main producer plane:* #16687 lets `onResult` return initial chunks so
  `step-start` is enqueued into the in-process stream pipeline
  (`stream/base/input.ts`), and #17370 shares processor state across those
  lifecycle chunks. The injection point only exists where the stream is
  request-scoped (C2).
- *Durable producer plane:* workflow steps publish agent-stream
  `step-start`/`step-finish` chunks directly to pubsub (`llm-execution`
  emits `step-start`; `llm-mapping` emits the deferred `step-finish` for
  tool-calling steps) — serialization at step boundaries (C1) rules out
  `onResult` injection.
- *Processor visibility is NOT divergent:* durable's consumer-side
  `MastraModelOutput` (`isLLMExecutionStep: true`, `stream-adapter.ts`) runs
  `processorRunner.processPart` on every chunk with shared
  `processorStates` — no chunk-type filter — so lifecycle chunks reach
  output processors with shared state through the shared pipeline. The
  *behavior* of #16687/#17370 is inherited; only the injection mechanism
  differs.
- *#21529 (`emitStepEvents: false`, `durable-loop-builder.ts`):* suppresses
  the workflow *engine's* own step events for the internal durable agentic
  workflow — those events repeatedly serialized cumulative conversation
  state and paused the run between model steps. Engine-surface perf
  constraint, not lost agent-stream functionality.

Porting #16687/#17370's injection to durable would double-emit lifecycle
chunks; porting #21529 to main has no motivation (main's in-process loop
workflow pays no serialization cost for step events).

## Execution plan

Per-PR process (every step): 1) diff the pair region → append ledger rows;
2) adjudicate each row; 3) land behavior *ports* as separate commits with
tests; 4) hoist the adjudicated winner into the base method / pure core;
5) delete the durable override + inline duplicates; 6) verify.

- **Step 0 — Foundations (1 PR):** delete `executeDurableToolCalls` (L9);
  move `normalize-model-output` to `loop/shared/`; add lint rules; port
  L1 + L2 to durable as standalone fixes with regression tests.
- **Step 1 — Skeleton (2 PRs, behavior-preserving):**
  1. `AgenticLoopBuilder` wrapping the main loop: topology + step methods
     that initially just delegate to today's step files;
     `createAgenticLoopWorkflow` → `new AgenticLoopBuilder(...).build()`.
  2. `DurableAgenticLoopBuilder extends` it, with every step method
     overridden to delegate to today's durable step files;
     `createDurableAgenticWorkflow` → `new DurableAgenticLoopBuilder(...).build()`.
  After this step the shared topology is real, nothing else has moved, and
  progress is countable: 8 step overrides + predicate + glue.
- **Step 2 — Contracts (1 PR):** define `IterationState` (converge main's
  closure vars onto it, in-memory) and `LoopRuntime`; implement
  `resolveRuntime` / `emitChunk` / `projectState` / `wrapToolExecution` /
  `onStepError` in base + durable subclass. No step hoisted yet.
- **Step 3 — Hoist small steps + predicate (1 PR each):** signal-drain →
  loop-continuation → background-task-check → is-task-complete → goal.
  Each PR deletes one durable override; adjudicates L3/L4, L10–L12.
- **Step 4 — Hoist tool-call:** `background-dispatch-core` +
  `execute-tool-core` into base `createToolCallStep()`; `markRunActive` via
  `wrapToolExecution`; adjudicates L5–L7.
- **Step 5 — Hoist llm-mapping + llm-execution per-chunk semantics:**
  `chunk-pipeline` + transform-helper merge (L8). Stream driver stays
  per-engine (documented override with ledger row, revisit after Phase 2
  stabilizes the evented driver).
- **Step 6 — Parity audit:** triage the 65 main-only / 106 durable-only
  commits against the new structure; port stragglers through base methods;
  close the ledger.
- **Step 7 — Main-loop de-scar:** hoisting concentrates RunScope reads in
  `resolveRuntime`; then evaluate removing dual `_internal` bookkeeping,
  hydration, refcount/TTL sweeper. `agent-controller`'s RunScope use is out
  of scope.

## Verification (every PR)

- Both loops' unit suites + conformance suite both legs
  (`unit:workflows/_test-utils`, CI-gated since Phase 1); core build +
  typecheck (`pnpm build:core`, `pnpm --filter ./packages/core check`).
- Skeleton and hoist PRs are behavior-preserving: no assertion changes except
  tests added for ledger ports.
- Each pure core gets its own colocated unit test (cheap to test
  exhaustively; e.g. `background-dispatch-core` gets the `false`/`0`/`''`
  resume matrix that #22363 lacked).
- Migration meter in each PR description: overrides remaining in
  `DurableAgenticLoopBuilder`.

## Sequencing vs other tracks

Phase 1 extraction PR ships first. Phase 2 (engine/WEP) is parallelizable
with Steps 0–2 here, but land Phase 2 items 5–7 before Steps 4–5 touch
tool-call/llm-execution — and note the skeleton helps Phase 2: the durable
subclass's `workflowFactory()` hook is exactly where the
default-vs-evented engine selection already lives.

## Decision points

1. **Concrete base = main loop** (durable overrides it) vs abstract base with
   two subclasses. Recommended: concrete — matches "durable inherits and
   overrides", keeps main's hot path free of indirection it doesn't use, and
   mirrors the existing `InngestAgent extends DurableAgent` chain
   (`InngestLoopBuilder extends DurableAgenticLoopBuilder` later).
2. **Ledger adjudications L3/L4** (signal-drain reason + error policy) —
   answers proposed in the Step 3 PR, but they change observable behavior of
   one loop; flag for review.
3. **L5 restart branch**: hoist `checkIfRunning→restart` into the base
   (main gains crash-recovery dispatch) or keep as durable override?
4. **`executeDurableToolCalls` deletion**: exported from
   `agent/durable/index.ts` (public surface). Delete outright (recommended —
   0 internal callers, undocumented) vs deprecate first?
5. **Stream driver end-state** (llm-execution): permanent sanctioned override
   or eventual hoist once evented ordering constraints are settled post-
   Phase 2? Default: permanent override with ledger row.
