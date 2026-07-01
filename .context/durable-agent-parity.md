# DurableAgent ↔ Agent Parity Matrix

> Internal engineering scratchpad. Restored after PR #18461 stripped it from `packages/core/src/agent/durable/`.
> When resuming work, drop this back at `packages/core/src/agent/durable/PARITY.md`.
> Status legend: ✅ supported, ⚠️ partial / in-process only, ❌ not supported.

## AgentExecutionOptions coverage in `DurableAgent.stream()`

### Fully serialized (durable + cross-process safe)

| Option | Status | Notes |
| --- | --- | --- |
| `modelSettings` (full object) | ✅ | `temperature`, `maxOutputTokens`, `topP`, `topK`, `presencePenalty`, `frequencyPenalty`, `stopSequences`, `seed`, `maxRetries` round-trip via `SerializableModelSettings`. `headers` are **stripped** from the serialized input (never persisted) and stored on `RunRegistryEntry.callTimeHeaders`; merged back in `llm-execution.ts` via `mergeLlmCallHeaders`. Model-config headers (`AgentModelManagerConfig.headers`) are also forwarded via `RegistryModelListEntry.headers`. |
| `maxSteps` | ✅ | |
| `runId` | ✅ | |
| `memory` | ✅ | |
| `requestContext` | ✅ | |
| `format` / `structuredOutput` / `output` | ✅ | |
| `returnScorerData` / `scorers` | ✅ | Scorer instances resolved by name from `mastra.getScorer` (falls back to `getScorerById`). Durable `addAgent` branch now auto-registers underlying-agent scorers so they are discoverable at workflow time. E2E parity covered by `durable-agent-scorers-e2e.test.ts`. |
| `requireToolApproval: true | false` | ✅ | |
| `autoResumeSuspendedTools` | ✅ | |
| `toolCallConcurrency` | ✅ | |
| `includeRawChunks` | ✅ | |
| `disableBackgroundTasks` | ✅ | Skips bg-task manager assignment on registry when true. |
| per-call `instructions` | ✅ | Overrides agent default in MessageList. |
| per-call `system` | ✅ | Appended as system message after context. |
| `tracingOptions` | ✅ | Serialized; spans rebuilt on resume. AGENT_RUN span forwards `attributes.conversationId/instructions/resolvedVersionId`, `metadata.entityVersionId`, and agent-level `tracingPolicy`. Resume span carries `(resumed)` suffix and `resumedFromSpanId` metadata. |
| `actor` | ✅ | Plumbed through `tool.execute({ actor })`. |
| `transform.targets` | ✅ | JSON-safe shadow of `ToolPayloadTransformPolicy.targets`. |
| `stopWhen` (data form) | ✅ | Data-shaped conditions serialized. Function form: see ⚠️ below. |

### In-process only (closures on the run registry)

These work for an in-process `DurableAgent.stream()` run but degrade on cross-process resume because the closure lives on `globalRunRegistry`, not in the workflow record.

| Option | Status | Notes |
| --- | --- | --- |
| `stopWhen` (function form) | ⚠️ | Stored on `RunRegistryEntry.stopWhen`; evaluated in `dowhile` predicate. |
| `prepareStep` | ⚠️ | `RunRegistryEntry.prepareStep`; appended as `PrepareStepProcessor` in `llm-execution.ts`. |
| `isTaskComplete` | ⚠️ | `scorers` + `onComplete` on registry; `scorerNames`, `strategy`, `timeout`, `parallel`, `suppressFeedback` serialized. Runs in dedicated `durable-is-task-complete` step. Feedback message is always appended to the message list; `suppressFeedback` only gates display via chunk payload + message metadata. |
| `transform.transformToolPayload` | ⚠️ | Closure on `RunRegistryEntry.toolPayloadTransform`. Applied in `llm-execution.ts` (tool-call chunks) and `tool-call.ts` (tool-result/error chunks). |
| `requireToolApproval` (function form) | ⚠️ | Stored on `RunRegistryEntry.requireToolApproval`; evaluated per tool call with real `(toolName, args, requestContext, workspace)`. Throws default to "require approval". Cross-process shadow degrades to `true`. |
| `onChunk`, `onStepFinish`, `onFinish`, `onError`, `onSuspended` | ⚠️ | Bridged via pubsub `AGENT_STREAM_TOPIC` events; subscribed by `createDurableAgentStream`. |
| `onAbort` | ⚠️ | Emitted from `llm-execution.ts` when caught error is an `AbortError`. Closes stream controller. |
| `onIterationComplete` | ⚠️ | Fired in `dowhile` predicate via `emitIterationCompleteEvent`. `continue: false` / `feedback` injection NOT honored — use `stopWhen` for control. |

### Not yet wired

| Option | Status | Notes |
| --- | --- | --- |
| `delegation` | ⚠️ | Per-call hooks (`onDelegationStart`, `onDelegationComplete`, `messageFilter`, `includeSubAgentToolResultsInModelContext`) are forwarded into `convertTools` at prepare time and baked into the sub-agent `CoreTool` wrappers stored on `RunRegistryEntry.tools`. Cross-process resume on a fresh worker loses the callbacks and degrades to default delegation. |
| `clientTools` | ⚠️ | In-process: flattened into `RunRegistryEntry.tools` at prepare time, so `resume()` sees them. Cross-process resume falls back to the agent's static tools (closures can't be JSON-serialized). |
| per-call `toolsets` | ⚠️ | Same as `clientTools` — preserved in-process via the run registry; not recoverable cross-process. |
| `abortSignal` | ⚠️ | In-process: external `abortSignal` is forwarded onto an internal `AbortController` stored on the registry; `result.abort()` is also exposed on `stream()`, `resume()`, `observe()`, and `streamUntilIdle`. Mid-iteration aborts surface `AbortError` from the LLM step and emit `ABORT` over pubsub so `onAbort` fires. Cross-process resume of an aborted run is not yet wired (resumed segments install a fresh controller). |

## DurableAgent methods not at parity

| Method | Status | Notes |
| --- | --- | --- |
| `stream()` | ✅ | Primary path; see option table above. |
| `resume()` (no `untilIdle`) | ✅ | |
| `resume({ untilIdle })` | ✅ | Routes through shared `runWithIdleWrapper` via `runResumeDurableStreamUntilIdle`. Initial turn calls `agent.resume`; bg-task continuations call `agent.stream([])` against the same memory scope (same semantics as `stream({ untilIdle })`). |
| `generate()` | ✅ | Thin wrapper over `stream()` + `MastraModelOutput.getFullOutput()`. Resolves on FINISH/ERROR/ABORT/SUSPENDED via internal `closeOnSuspend` flag on the stream adapter. On suspend the registry entry is preserved so `resumeGenerate()` can pick it up. |
| `resumeGenerate()` | ✅ | Thin wrapper over `resume()` with the same close-on-suspend bridge. Resume now subscribes from a computed pubsub offset (`CachingPubSub.getHistory().length`) so replayed events from the original run don't re-trigger close. Awaits the workflow execution promise on suspend so the snapshot is persisted before returning. |
| `generateLegacy`, `streamLegacy` | n/a | Out of scope per user. |
| `network*` methods | n/a | Out of scope. |
| `streamUntilIdle` | n/a | Deprecated in both Agent and DurableAgent. |
| `generateTitleFromUserMessage`, `genTitle` | ❌ | Delegate non-durably. |
| `getSkill`, `listSkills`, `listScorers`, `listWorkflows` | ❌ | Delegate non-durably (mostly read-only metadata — verify if this matters). |

## Known skips / degradations

- `durable-agent-background-tasks.e2e.test.ts` now runs via the gateway-mock LLM recorder (mirrors the regular agent's `background-tasks.e2e.test.ts`). Skips automatically in `auto` mode without `OPENAI_API_KEY` and without recordings; replays from `__recordings__/core-src-agent-durable-__tests__-durable-agent-background-tasks.e2e/` when seeded.
- Cross-process resume cannot recover any registry-stored closure (see ⚠️ table). The serialized shadow is the source of truth on resume.
- `parity.test.ts` has 14 todo tests documenting remaining divergences.

## Files of interest

- `packages/core/src/agent/durable/types.ts` — `SerializableDurableOptions`, `RunRegistryEntry`, event data types.
- `packages/core/src/agent/durable/preparation.ts` — option resolution and registry storage.
- `packages/core/src/agent/durable/utils/serialize-state.ts` — JSON-safe shadow serialization.
- `packages/core/src/agent/durable/durable-agent.ts` — `DurableAgentStreamOptions` surface.
- `packages/core/src/agent/durable/stream-adapter.ts` — pubsub → callback bridge.
- `packages/core/src/agent/durable/workflows/create-durable-agentic-workflow.ts` — `dowhile` predicate, iteration events.
- `packages/core/src/agent/durable/workflows/steps/` — `llm-execution.ts`, `tool-call.ts`, `is-task-complete.ts`, `background-task-check.ts`, `scorer-execution.ts`.
- `packages/core/src/agent/durable/utils/apply-tool-payload-transform.ts` — transform helper.
- `packages/core/src/agent/durable/utils/resolve-runtime.ts` — `toolRequiresApproval`.

## Remaining tasks (post PR #18461)

1. `docs_full_pass` — Rewrite `docs/agents/durable-agents.mdx` capability matrix and `reference/agents/durable-agent.mdx` per-option notes now that the bridge is complete.
2. Seed `__recordings__/core-src-agent-durable-__tests__-durable-agent-background-tasks.e2e/` once with a real `OPENAI_API_KEY` so the e2e suite replays in CI.

---

# InngestAgent ↔ DurableAgent parity (branch `inngest-durable-agent`)

`createInngestAgent()` wraps a `Mastra` `Agent` with Inngest's durable execution engine. The original parity work (PR #18461) only covered the in-memory `DurableAgent`; `InngestAgent` lagged on the execution-option surface, the abort path, `untilIdle` on `resume()`, and `generate()` / `resumeGenerate()`. This section tracks where `InngestAgent` now lines up with `DurableAgent` after the slices on this branch.

> All option surface is plumbed through the shared `prepareForDurableExecution`, so durability / cross-process semantics match `DurableAgent` exactly. The Inngest dev runtime executes steps in separate Node processes, so the same in-process closures that degrade for `DurableAgent` after a worker hop also degrade here — usually on the very first hop.

## `InngestAgentStreamOptions` coverage

| Option | DurableAgent | InngestAgent | Notes |
| --- | --- | --- | --- |
| `modelSettings` (full object) | ✅ | ✅ | Same serialization path; `headers` stripped from serialized input, stored on `RunRegistryEntry.callTimeHeaders`. |
| `maxSteps`, `runId`, `memory`, `requestContext` | ✅ | ✅ | |
| `format` / `structuredOutput` / `output` | ✅ | ✅ | Type widened on this branch. |
| `versions`, `activeTools` | ✅ | ✅ | Type widened on this branch. |
| `requireToolApproval: true | false` | ✅ | ✅ | |
| `requireToolApproval` (function form) | ⚠️ | ⚠️ | Closure parked on `globalRunRegistry`; cross-worker (Inngest) degrades to `true`. |
| `autoResumeSuspendedTools`, `toolCallConcurrency`, `includeRawChunks` | ✅ | ✅ | |
| `disableBackgroundTasks` | ✅ | ✅ | |
| per-call `instructions`, `system` | ✅ | ✅ | |
| `tracingOptions` | ✅ | ✅ | |
| `actor` | ✅ | ✅ | |
| `transform.targets` | ✅ | ✅ | JSON-safe. |
| `transform.transformToolPayload` | ⚠️ | ⚠️ | Registry closure; degrades cross-worker. |
| `stopWhen` (data form) | ✅ | ✅ | |
| `stopWhen` (function form) | ⚠️ | ⚠️ | Registry closure; cross-worker degrades to `maxSteps`. |
| `prepareStep` | ⚠️ | ⚠️ | Registry closure. |
| `isTaskComplete` | ⚠️ | ⚠️ | Same registry / `scorerNames` shadow as `DurableAgent`. |
| `delegation` | ⚠️ | ⚠️ | Sub-agent `CoreTool` wrappers stored on registry; cross-worker degrades. |
| `clientTools`, `toolsets` | ⚠️ | ⚠️ | Flattened into `RunRegistryEntry.tools`; in-process only. |
| `onChunk`, `onStepFinish`, `onFinish`, `onError`, `onSuspended` | ⚠️ | ⚠️ | Bridged via `AGENT_STREAM_TOPIC` pubsub through `createDurableAgentStream`. |
| `onAbort` | ⚠️ | ⚠️ | Threaded into `createDurableAgentStream` on both `stream()` and `resume()`. |
| `onIterationComplete` | ⚠️ | ⚠️ | Same caveat as `DurableAgent`: `continue: false` / `feedback` injection is not honored. |
| `abortSignal` | ⚠️ | ⚠️ | Internal `AbortController` per `stream()` / `resume()`. External signal is forwarded (incl. already-aborted), stored on registry, surfaced via `result.abort()`. Same cross-process caveat as `DurableAgent`. |
| `_skipBgTaskWait` | ✅ | ✅ | |

## `InngestAgent` methods

| Method | DurableAgent | InngestAgent | Notes |
| --- | --- | --- | --- |
| `stream()` | ✅ | ✅ | Now creates an `AbortController`, registers on `globalRunRegistry`, threads new callbacks, exposes `result.abort()`, and tracks the workflow trigger promise on `RunRegistryEntry.workflowExecution`. |
| `resume()` (no `untilIdle`) | ✅ | ✅ | Now installs a fresh `AbortController` scoped to the resumed segment, patches it onto the existing global registry entry, threads `onAbort`, and exposes `abort`. |
| `resume({ untilIdle })` | ✅ | ✅ | Delegates to `runResumeDurableStreamUntilIdle` (same shared idle wrapper used by `DurableAgent`). |
| `observe()` | ✅ | ✅ | Returns a no-op `abort()` to satisfy the contract; the subscription owns its own closing path. Replay backed by `CachingPubSub` wrapper (PR #18535). |
| `generate()` | ✅ | ✅ | Local preparation with `methodType: 'generate'`. Uses `closeOnSuspend: true` on the stream adapter, awaits `globalRunRegistry.get(runId).workflowExecution` on suspend so the snapshot lands before returning. Conditional cleanup mirrors `DurableAgent.generate()`. |
| `resumeGenerate()` | ✅ | ✅ | Delegates to `resume({ [CLOSE_ON_SUSPEND]: true })` + `output.getFullOutput()`; awaits `workflowExecution` on suspend. |
| `prepare()` | ✅ | ✅ | Pre-branch parity. |

## Inngest-specific caveats

- **Cross-worker = first hop for Inngest.** Even on a single dev machine, `inngest-cli dev` spawns each step in its own Node process. Any registry-stored closure (`stopWhen` fn, `prepareStep`, `transformToolPayload`, function-form `requireToolApproval`, callbacks, in-process tools) is lost the moment a step crosses workers. The serialized JSON shadow on `workflowInput.options` is the source of truth.
- **`result.abort()` ≠ cross-worker cancellation.** It flips the `AbortSignal` stored on `globalRunRegistry`, which the LLM step reads inside `llm-execution.ts` when it owns the registry entry. A step running on a different worker will not see the signal. Stream subscribers always get an `ABORT` event because `emitAbortEvent` rides the agent's `CachingPubSub`.
- **`generate()` / `resumeGenerate()` suspend-await.** Both methods await `workflowExecution` on suspend so the workflow snapshot is persisted before the call returns. The promise is the result of `inngest.send()` for the initial run and `workflow.createRun().resume()` for resumes. If a future subclass replaces `triggerWorkflow` with a fire-and-forget call that resolves before the snapshot lands, `resumeGenerate()` will need to await something else (this is the same limitation called out in PR #18508 review).

## Files touched on this branch

- `workflows/inngest/src/durable-agent/create-inngest-agent.ts` — widened `InngestAgentStreamOptions`, added `InngestAgentResumeOptions`, abort/iteration callbacks, `untilIdle` on resume, `generate()` / `resumeGenerate()`.
- `packages/core/src/agent/durable/index.ts` — re-exports `globalRunRegistry` and `runResumeDurableStreamUntilIdle` so the Inngest package can consume them.
- `workflows/inngest/src/__tests__/create-inngest-agent.test.ts` — `InngestAgent parity surface` describe block (5 tests covering option threading, abort path, external signal forwarding, workflow-execution tracking, and the durable `generate`/`resumeGenerate` surface).

## Remaining tasks for this branch

1. Changeset for `@mastra/inngest` summarizing the parity bridge.
2. Manual verification against the `examples/durable-agents` `inngestResearchAgent` once the changeset lands (covers abort, `untilIdle` resume, `generate`).
3. Open the PR.
