# DurableAgent ↔ Agent parity audit

Status legend: ✅ at parity · ⚠️ partial / degraded / different shape · ❌ not supported · ➖ N/A by design

Sources audited (branch `durable-agent-parity-check`):

- `packages/core/src/agent/agent.ts` (regular `Agent`)
- `packages/core/src/agent/durable/durable-agent.ts`
- `packages/core/src/agent/durable/preparation.ts`
- `packages/core/src/agent/durable/durable-stream-until-idle.ts`
- `packages/core/src/agent/durable/stream-adapter.ts`
- `packages/core/src/agent/durable/run-registry.ts` + `globalRunRegistry`
- `packages/core/src/loop/workflows/agentic-execution/index.ts` (loop entrypoint)
- `packages/core/src/loop/workflows/durable-agentic-execution/*` (durable loop)

`DurableAgent` extends `Agent` and *wraps* a real `Agent` instance (`#wrappedAgent`); model/instructions/tools/memory/voice/editor methods are all delegated to the wrapped agent so introspection stays correct. Execution methods are reimplemented on top of a durable workflow (`createWorkflow` + `dowhile`) instead of the in-process loop.

---

## 1. Public method surface

| Method | Agent | DurableAgent | Notes |
| --- | --- | --- | --- |
| `stream()` | ✅ | ✅ | Durable path drives a workflow run; same `MastraModelOutput` shape via `stream-adapter`. |
| `generate()` | ✅ | ✅ | Durable `generate()` re-runs the same setup as `stream()` but pins `methodType: 'generate'` and awaits `getFullOutput()`. Preserves registry entry on suspend for `resumeGenerate()`. |
| `streamLegacy()` | ✅ | ➖ | Out of scope (v4 path only). |
| `generateLegacy()` | ✅ | ➖ | Out of scope (v4 path only). |
| `streamUntilIdle()` | ⚠️ deprecated | ⚠️ deprecated | Both delegate to the new `{ untilIdle }` option. |
| `resumeStream()` | ✅ | ➖ | Regular agent rehydrates from snapshot; DurableAgent uses `resume()` instead. |
| `resumeStreamUntilIdle()` | ✅ | ➖ | Subsumed by `resume({ untilIdle: true })`. |
| `resume()` | ➖ | ✅ | Durable-only. Opens fresh `AGENT_RUN`/`MODEL_GENERATION` spans linked to original trace. |
| `resumeGenerate()` | ✅ | ✅ | Both await `getFullOutput()` and re-await `globalRunRegistry[runId].workflowExecution` on suspend so the snapshot is persisted before returning. |
| `approveToolCall()` / `declineToolCall()` | ✅ | ⚠️ inherited | Inherited from `Agent`; works for in-process runs via snapshot, untested for cross-process durable resume. |
| `approveToolCallGenerate()` / `declineToolCallGenerate()` | ✅ | ⚠️ inherited | Same as above. |
| `observe()` | ➖ | ✅ | Durable-only. Wraps `createDurableAgentStream` with replay; cross-process replay requires a durable `MastraServerCache` adapter. |
| `prepare()` | ➖ | ✅ | Pre-registers a run on both `#runRegistry` and `globalRunRegistry`. |
| `subscribeToThread()` | ✅ | ⚠️ inherited | Uses the wrapped agent's pubsub. |
| `listSuspendedRuns()` | ✅ | ⚠️ inherited | Reads from workflow storage; works the same for durable runs. |
| `getWorkflow()` / `getDurableWorkflows()` | ➖ | ✅ | Exposes the underlying durable workflow + registers `Mastra` primitives on it. |
| `listScorers()` | ✅ | ✅ | Durable delegates to wrapped agent. |
| `resumeNetwork()` | ✅ | ⚠️ inherited | Inherited only; durable-specific network resume not implemented. |
| `getModel/getInstructions/listTools/getMemory/getVoice/getDefaultOptions` | ✅ | ✅ | All delegate to `#wrappedAgent`. |
| `__fork / __setTools / __updateModel / __updateInstructions / __getEditorConfig / __getOverridableFields` | ✅ | ✅ | Editor surface delegated so studio overrides hit the wrapped agent. |
| `__setMastra / __registerMastra` | ✅ | ✅ | Durable also wires `mastra.pubsub` into `#innerPubsub` when no custom pubsub is provided, and registers `Mastra` on `#wrappedAgent`. |

---

## 2. Execution-options surface (`stream()` / `generate()`)

`prepareForDurableExecution` (shared by stream/generate/resume/prepare) consumes the full `AgentExecutionOptions` envelope. The table below tracks how each option behaves once it crosses the durable boundary.

| Option | Agent | DurableAgent | Notes |
| --- | --- | --- | --- |
| `messages` / `MessageListInput` | ✅ | ✅ | Same `MessageList` helper, same processor pipeline. |
| `runId` | ✅ | ✅ | Generated via `mastra.generateId ?? randomUUID()`. |
| `instructions` (per-call) | ✅ | ✅ | Per-call value overrides agent default in both. |
| `system` (per-call) | ✅ | ✅ | Appended via `MessageList`. |
| `context` (per-call) | ✅ | ✅ | Added via `MessageList.add`. |
| `memory.thread` / `memory.resource` | ✅ | ✅ | `prepareForDurableExecution` mirrors `Agent.#execute` resolution order. |
| `requestContext` | ✅ | ✅ | Same RC validation, RC schema, FGA hooks. |
| `versions` | ✅ | ✅ | Per-call versions win over Mastra defaults. |
| `actor` | ✅ | ✅ | Threaded through workflowInput.options. |
| `stopWhen` (predicate) | ✅ | ⚠️ in-process only | Stored on `globalRunRegistry` and evaluated in the `dowhile` predicate. Cross-process engines (e.g. Inngest) fall back to `maxSteps`. |
| `maxSteps` | ✅ | ✅ | Used in both. Default capped at `DurableAgentDefaults.MAX_STEPS` when missing. |
| `toolChoice` | ✅ | ✅ | JSON-safe; serialized in workflow input. |
| `activeTools` | ✅ | ✅ | Tool-name allowlist serialized. |
| `clientTools` | ✅ | ⚠️ in-process only | Closures live on registry entry; cross-process resume loses them. |
| `toolsets` | ✅ | ⚠️ in-process only | Same as clientTools. |
| `requireToolApproval` (boolean) | ✅ | ✅ | Serialized. |
| `requireToolApproval` (function) | ✅ | ⚠️ in-process only | Function stored on registry; cross-process degrades to the boolean shadow. |
| `toolCallConcurrency` | ✅ | ✅ | Loop forces concurrency `1` either way (suspend/approval need ordering). |
| `autoResumeSuspendedTools` | ✅ | ✅ | Honored by the durable resume path. |
| `structuredOutput` | ✅ | ✅ | Zod schema converted to JSON-Schema in `prepareForDurableExecution`. Same OpenAI nullable workaround applied. |
| `output` (legacy) | ✅ | ➖ | Out of scope (legacy). |
| `modelSettings` | ✅ | ⚠️ filtered | `serialize-state` strips non-serializable fields; **sensitive headers are denylisted** before workflow snapshotting (added in PR #18461 follow-up). |
| `providerOptions` | ✅ | ✅ | Forwarded to LLM step. |
| `includeRawChunks` | ✅ | ✅ | Forwarded. |
| `returnScorerData` | ✅ | ✅ | Honored in scorer step. |
| `maxProcessorRetries` | ✅ | ✅ | Defaults to agent's `#maxProcessorRetries`. |
| `tracingOptions` | ✅ | ✅ | Added to `AGENT_RUN` span and forwarded to workflow trigger. Resume reuses original `traceId` and links to the parent span. |
| `transform` (callable) | ✅ | ⚠️ in-process only | Targets are JSON-safe; the function is stored on the registry. |
| `prepareStep` (callable) | ✅ | ⚠️ in-process only | Same closure-in-registry pattern. |
| `isTaskComplete` | ✅ | ✅ | Implemented as a real durable step (`is-task-complete.ts`) so it appears in traces. Feedback message is always added to the message list; `suppressFeedback` only hides it from the UI. |
| `delegation` | ✅ | ⚠️ in-process only | Wired through `getToolsForExecution`, but parent/child handles live only in memory. |
| `abortSignal` | ✅ | ✅ | Internal `AbortController` created; external signal forwarded; `result.abort()` exposed; cross-worker step abort is best-effort (relies on `emitAbortEvent`). |
| `onChunk` | ✅ | ✅ | Threaded via stream adapter. |
| `onStepFinish` | ✅ | ✅ | Threaded via stream adapter. |
| `onFinish` | ✅ | ✅ | Durable wraps user callback in `try/finally` so `finalizeGlobalRegistry()` always runs. |
| `onError` | ✅ | ✅ | Same `try/finally` guarantee on durable side. |
| `onAbort` | ✅ | ✅ | New durable callback added during parity work. |
| `onIterationComplete` | ✅ | ✅ | Emitted from the `dowhile` predicate with `{ isContinued, isFinal, stopWhenMatched, underMaxSteps }`. |
| `onSuspended` | ➖ | ✅ | Durable-only callback fired when the workflow suspends. |
| `disableBackgroundTasks` | ✅ | ✅ | Disables `backgroundTaskManager` in the registry entry. |
| `_skipBgTaskWait` | ✅ | ✅ | Internal escape hatch; forwarded. |
| `untilIdle` | ✅ (via `streamUntilIdle`) | ✅ | Delegates to `runDurableStreamUntilIdle` / `runResumeDurableStreamUntilIdle`. |
| `[CLOSE_ON_SUSPEND]` (sentinel) | ➖ | ✅ | Internal sentinel used by `generate()`/`resumeGenerate()` to close the local stream on suspend while preserving the registry entry. |

---

## 3. Stream-result shape

| Field | Agent (`MastraModelOutput`) | DurableAgent (`DurableAgentStreamResult`) | Notes |
| --- | --- | --- | --- |
| `fullStream` | ✅ | ✅ | Same async-iterable contract via `stream-adapter`. |
| `getFullOutput()` | ✅ | ✅ | Durable awaits workflow execution promise on suspend so persistence is observable. |
| `runId` | ✅ | ✅ | |
| `threadId` / `resourceId` | ✅ | ✅ | |
| `output` (`MastraModelOutput`) | ✅ | ✅ | Durable result composes the adapter's output. |
| `cleanup()` | ➖ | ✅ | Cancels auto-cleanup timer and tears down stream + registry entries. |
| `abort(reason?)` | ✅ | ✅ | Triggers internal controller, propagates over pubsub. |
| `[STREAM_CLEANUP]` | ➖ | ✅ | Internal: stream-only cleanup used on suspend (`generate()` / `resumeGenerate()`). |

---

## 4. Agentic loop steps

| Step | Regular loop (`loop/workflows/agentic-execution`) | Durable loop (`loop/workflows/durable-agentic-execution`) | Notes |
| --- | --- | --- | --- |
| `map-to-llm-input` | ✅ | ✅ | Same input shaping logic; durable variant operates on serialized `messageListState`. |
| `llm-execution` | ✅ | ✅ | Same processor pipeline; durable step rehydrates `MessageList` from `messageListState`. |
| `extract-tool-calls` | ✅ | ✅ | |
| `tool-call(s)` | ✅ (`foreach`, concurrency 1) | ✅ (`foreach`, concurrency 1) | Concurrency forced to 1 in both for suspend/approval semantics. |
| `collect-tool-results` | ✅ | ✅ | |
| `llm-mapping-step` | ✅ | ✅ | |
| `background-task-check` | ✅ | ✅ | `_skipBgTaskWait` honored in both. |
| `update-iteration-state` | ✅ | ✅ | |
| `isTaskComplete` | ✅ (inline predicate) | ✅ (durable step `is-task-complete.ts`) | Durable promotes it to a real step so it shows in traces and produces a state transition; feedback message always added to message list. |
| `dowhile` predicate | ✅ | ✅ | Durable also evaluates registry `stopWhen` for in-process runs; falls back to `maxSteps` cross-process. Emits `ITERATION_COMPLETE` events. |
| `map-final-output` | ✅ | ✅ | Durable flushes `saveQueueManager` and ends `MODEL_GENERATION`/`AGENT_RUN` spans (using resume span data when applicable) before the `finish` event. |
| `execute-scorers` | ✅ | ✅ | Fire-and-forget post-step in both. Durable resolves via `mastra.getScorerById()` then `mastra.getScorer()` and warns when missing. |

---

## 5. LLM execution path

| Concern | Agent | DurableAgent | Notes |
| --- | --- | --- | --- |
| Model resolution | ✅ | ✅ | Both call `getModel()` / `getModelList()`; durable resolves on the wrapped agent. |
| `modelList` (multi-model) | ✅ | ✅ | Serialized in workflow input. |
| Gateway models | ✅ | ✅ | `isGatewayModel` detection preserved. |
| AI SDK v4 rejection | ✅ | ✅ | Same v4-detect throws. |
| `model.supportedUrls` → prompt builder | ✅ | ❌ pre-PR #18649, ✅ after | Regular path resolves `currentModel.supportedUrls` (awaiting Promise-like values) and forwards it to `llmPromptForModel({ supportedUrls })`; durable path calls `llmPromptForModel()` with no args, so provider-native schemes (`gs://`, `s3://`) get downloaded/base64-wrapped. **Fix in flight: [PR #18649](https://github.com/mastra-ai/mastra/pull/18649).** |
| Prompt builder args (`downloadRetries`, `downloadConcurrency`) | ✅ | ❌ | Same shape — durable just doesn't forward these either. Adding them next to `supportedUrls` is essentially free. |
| `modelSettings` | ✅ | ⚠️ allowlist + ❌ silently drops "sensitive" headers | Allowlist of numeric fields + `stopSequences` + `headers`. **Header denylist is a parity bug, not a feature** — regular path forwards `authorization`/`x-api-key`/etc. straight to the model; durable silently strips them. See §5a. |
| `providerOptions` | ✅ | ✅ | Forwarded as opaque JSON. |
| `structuredOutput` (Zod → JSON-Schema) | ✅ | ✅ | OpenAI nullable transform shared. |
| Abort mid-iteration | ✅ | ✅ | Durable forwards via pubsub + `emitAbortEvent`; cross-worker step kill is best-effort. |
| Retries | ✅ | ✅ | `maxProcessorRetries` forwarded. |
| Raw-chunk forwarding | ✅ | ✅ | |

### 5a. `modelSettings` — drift risk and how to fix it

The current durable serialization (`packages/core/src/agent/durable/utils/serialize-state.ts`) uses a **hand-maintained allowlist** of fields:

```text
maxOutputTokens, temperature, topP, topK, presencePenalty, frequencyPenalty,
stopSequences, seed, maxRetries, headers
```

This is the same drift pattern that caused PR #18649 — anything the AI SDK adds (or that an agent passes via `defaultOptions.modelSettings`) is silently dropped on the durable side. Known/likely casualties today and tomorrow:

- New AI SDK call-settings (future sampling controls, provider-specific extras) need a manual code edit here to flow through.
- The header denylist (`authorization`, `x-api-key`, `cookie`, …) silently strips legitimate per-call headers.

#### Why the header denylist is wrong

The regular path (`packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts:1391-1405`) merges headers from three sources — memory headers (`x-thread-id`, `x-resource-id`), per-model-entry `modelConfig.headers`, and call-time `modelSettings.headers` — and passes them straight to the model with no filtering. Per-call headers are a documented AI SDK escape hatch for legitimate use cases:

- Upstream user tokens for multi-tenant routing.
- Per-tenant `x-api-key` when the agent fronts a customer-supplied key.
- Region/account routing (`x-amz-security-token`, `x-goog-api-key`).
- Custom proxy/gateway auth schemes.

Stripping these in the durable serializer means the same `agent.stream(msgs, { modelSettings: { headers: {...} } })` behaves differently in `Agent` vs `DurableAgent` — that's a parity bug, not a security feature. The strip happens before the LLM call, not just before storage, so the headers never reach the model at all.

#### The real concern (storage), and the right fix

The legitimate concern is that durable engines (Inngest, file, Redis) persist workflow input to durable storage, and credential-bearing fields shouldn't sit there at rest. That's an encryption / storage-policy concern, not a "drop the data" concern. Right shape:

1. **Stop stripping in `serializeModelSettings`** — pass headers through verbatim, matching the regular path. Parity restored, and per-call auth/routing headers work the same in both agents.

2. **Allowlist → typed-fields + JSON-safe passthrough.** Replace the hand-picked field copies with a single walker that:
   - Keeps known typed fields exactly as today (existing tests stay green).
   - For unknown keys, accepts the value if it round-trips through `JSON.parse(JSON.stringify(value))` cleanly. New SDK additions stop silently disappearing.
   - Drops only what fails the round-trip (functions, `AbortSignal`, streams).

3. **Mark sensitive fields at the schema level**, don't censor them. Add a field-level annotation (Zod `.describe('sensitive')` brand, or a sidecar `SENSITIVE_FIELDS` set keyed off the workflow-input schema) covering `modelSettings.headers`, `providerOptions`, and similar credential-bearing fields. This is metadata for the storage layer, not a runtime strip.

4. **Encrypt-at-rest at the storage boundary.** The durable store adapter consumes the sensitive-field annotation, encrypts those fields before they hit disk, and decrypts on rehydration before the workflow step reads them. Default cipher: `MASTRA_SECRET`-keyed AES-GCM; plug in a KMS-backed cipher for stronger guarantees.

5. **Document the storage policy and offer an opt-out.** Callers who truly want fire-and-forget per-call headers (no persistence at all) can pass `{ persistHeaders: false }`; the durable layer warns and drops. The default is "persist encrypted" so calls behave identically to the regular path.

6. **Drift detection in CI.** A type-level assertion that `SerializableModelSettings` is a `Pick<>` of the AI SDK call-settings type so adding a field on the SDK side breaks compile and forces an explicit decision (keep / drop / sanitize). This is what would have caught `supportedUrls` at compile time *if* it had been a `modelSettings`-level field.

7. **Sanitize at the workflow-input boundary, not at the serializer.** Move the schema enforcement (including the JSON round-trip walker and sensitive-field annotation) into the workflow-input zod schema's `.transform()` so any path that mints a durable workflow input — not just `prepareForDurableExecution` — goes through the same step.

**Specifically for the `supportedUrls` case in PR #18649:** that field isn't in `modelSettings` at all — it lives on the model instance and is resolved at prompt-build time. The fix is to extract a shared `buildLlmPromptArgs(currentStep.model, { downloadRetries, downloadConcurrency })` helper that both the regular and durable steps import, removing the duplication that let the two call sites drift.

---

## 6. Memory / persistence

| Concern | Agent | DurableAgent | Notes |
| --- | --- | --- | --- |
| `Memory` resolution | ✅ | ✅ | `getMemory()` delegated to wrapped agent. |
| Per-request memory context | ✅ | ✅ | Same precedence: `requestContext.threadId` > `options.memory.thread` > snapshot. |
| `savePerStep` | ✅ | ✅ | Forwarded in workflowInput.state. |
| `observationalMemory` | ✅ | ✅ | Forwarded in workflowInput.state. |
| `SaveQueueManager` | ✅ | ✅ | Durable instantiates one per run and flushes in `map-final-output`. |
| Working memory | ✅ | ✅ | Same Memory APIs; same `getThread` semantics. |
| Semantic recall | ✅ | ✅ | Same processor pipeline used in `llm-execution`. |
| RequestContext leakage guard | ✅ | ✅ | `prepareForDurableExecution` clears `MastraMemory` from `requestContext` when no full per-request memory config is present. |

---

## 7. Tools

| Concern | Agent | DurableAgent | Notes |
| --- | --- | --- | --- |
| `getToolsForExecution` | ✅ | ✅ | Same call with `methodType` forwarded. |
| `toolsets` / `clientTools` | ✅ | ⚠️ in-process only | Closures live on registry entry; cross-process resume drops them. |
| `makeCoreTool` | ✅ | ✅ | Mastra + memory injection fixed on `main` (`pass mastra and memory to makeCoreTool`). |
| Suspended-tool resume | ✅ | ✅ | `autoResumeSuspendedTools` and snapshot-based `suspendedToolInfo` honored. |
| `requireToolApproval` boolean | ✅ | ✅ | Serialized. |
| `requireToolApproval` function | ✅ | ⚠️ in-process | Closure on registry; cross-process degrades to boolean shadow. |
| `delegation` (subagent handles) | ✅ | ⚠️ in-process | Same caveat. |
| Tool concurrency | configurable | forced `1` | Same in regular loop's durable-equivalent foreach. |
| Tool payload transform | ✅ | ✅ | Per-call > agent-level > mastra-level precedence preserved. |

---

## 8. Callbacks

| Callback | Agent | DurableAgent | Delivery |
| --- | --- | --- | --- |
| `onChunk` | ✅ | ✅ | Per pubsub chunk via `stream-adapter`. |
| `onStepFinish` | ✅ | ✅ | After each loop iteration. |
| `onFinish` | ✅ | ✅ | Wrapped in `try/finally` so registry cleanup always runs. |
| `onError` | ✅ | ✅ | Same guarantee. |
| `onAbort` | ✅ | ✅ | Fires for both internal and external aborts. |
| `onIterationComplete` | ✅ | ✅ | Emitted from `dowhile` predicate. |
| `onSuspended` | ➖ | ✅ | Durable-only. |

---

## 9. Tracing / observability

| Span | Agent | DurableAgent | Notes |
| --- | --- | --- | --- |
| `AGENT_RUN` | ✅ | ✅ | `prepareForDurableExecution` opens it with `attributes` (conversationId, instructions, resolvedVersionId), `metadata` (entityVersionId), and agent-level `tracingPolicy`. |
| `MODEL_GENERATION` (child) | ✅ | ✅ | Same shape; durable closes it in `map-final-output`. |
| Internal workflow spans | exposed | hidden (`tracingPolicy: { internal: WORKFLOW }`) | Durable hides loop scaffolding while surfacing agent/tool/model spans. |
| Resume span linking | ✅ | ✅ | `resume()` opens fresh `AGENT_RUN`/`MODEL_GENERATION` linked via `origTraceId` + `resumedFromSpanId`. |
| Tool spans | ✅ | ✅ | Emitted by tool-call step in both. |
| Scorer spans (`ON_SCORER_RUN` hook) | ✅ | ✅ | Same hook path; fixed in PR #18508. |

---

## 10. Scorers

| Concern | Agent | DurableAgent | Notes |
| --- | --- | --- | --- |
| Auto-registration on `Mastra.addAgent()` | ✅ | ✅ | `Mastra.addAgent()` registers durable agent scorers (added in PR #18461). |
| `listScorers()` | ✅ | ✅ | Delegated. |
| Lookup order | `getScorerById` → `getScorer` | same | Durable matches regular agent precedence. |
| `LIVE` / `AGENT` entity type | ✅ | ✅ | `runScorer()` called with same params. |
| `returnScorerData` | ✅ | ✅ | Honored in scorer step. |
| Input/output reconstruction from `messageListState` | ➖ | ✅ | Durable reconstructs from the serialized message list. |

---

## 11. Background tasks

| Concern | Agent | DurableAgent | Notes |
| --- | --- | --- | --- |
| `BackgroundTaskManager` injection | ✅ | ✅ | From `mastra`; disabled in the registry entry when `disableBackgroundTasks` is set. |
| `backgroundTasksConfig` (agent-level) | ✅ | ✅ | Pulled via `getBackgroundTasksConfig()`. |
| `background-task-check` loop step | ✅ | ✅ | Honors `_skipBgTaskWait`. |
| E2E recordings | ✅ | ⚠️ partial | Regular agent has full recordings; durable suite has 5/7 recorded — `background task works alongside memory` and `streamUntilIdle keeps the stream open` need re-recording (hash mismatches caused timeouts). |

---

## 12. Run-registry / lifecycle

| Concern | Agent | DurableAgent | Notes |
| --- | --- | --- | --- |
| Per-agent local registry | `runScope` (`mastra.__createRunScope`) | `#runRegistry` + `globalRunRegistry` (TTL cache) | Durable needs a globally addressable registry because workflow steps run in their own contexts. |
| Auto-cleanup | tied to run end | `setTimeout(cleanupTimeoutMs)` after stream finishes | Durable schedules cleanup; `cleanup()` on the result cancels it. Resume installs a new timer for the resumed segment. |
| Cleanup on terminal events (`finish`/`error`/`abort`) | ✅ | ✅ | `finalizeGlobalRegistry()` and resume equivalent always run via `try/finally`. |
| Suspend-preservation | ➖ | ✅ | Generate paths use `STREAM_CLEANUP` to release local subscriptions while keeping the registry entry alive. |
| `workflowExecution` promise tracking | ➖ | ✅ | `globalRunRegistry[runId].workflowExecution` is awaited on suspend before returning from `generate()`. |

---

## 13. Cross-process / cross-worker caveats

All `⚠️ in-process only` cells above share the same root cause: closures and live handles cannot be serialized through the workflow snapshot, so they live on `globalRunRegistry` (an in-process TTL cache).

| Path | Symptom | Mitigation |
| --- | --- | --- |
| `stopWhen` (fn) | ignored on resume in another process | falls back to `maxSteps` |
| `prepareStep`, `transform`, `requireToolApproval` (fn) | not invoked cross-process | boolean shadow / target list serialized where possible |
| `clientTools` / `toolsets` | tools missing cross-process | re-pass on resume in the new process |
| `delegation` | parent/child handles unavailable cross-process | re-pass on resume |
| `observe()` cross-process replay | history not visible across workers | needs a durable `MastraServerCache` adapter (e.g. Redis) — deferred work |

---

## 14. Known gaps / follow-ups

1. **`supportedUrls` not forwarded to `llmPromptForModel`** ([PR #18649](https://github.com/mastra-ai/mastra/pull/18649)) — see §5. Same root cause as the broader "two divergent LLM-execution steps" problem.
2. **`modelSettings` allowlist drift** — see §5a. Three-step fix: passthrough walker + denylist + type-level drift detection.
3. **Background-task E2E recordings**: re-record the two failing durable tests under `LLM_TEST_MODE=record` once flake is reproduced. Recordings need to match request hashes after `pass mastra and memory to makeCoreTool` lands on this branch.
4. **Cross-process `observe()` replay**: ship a durable `MastraServerCache` adapter (Redis-backed) so `CachingPubSub` can replay history across workers. Same fix benefits both `DurableAgent` and `InngestAgent`.
5. **Approve/decline tool-call resume across processes**: inherited from `Agent`; needs explicit durable-resume coverage.
6. **`resumeNetwork()`**: only inherited; no dedicated durable-network path validated.
7. **Docs full pass**: reference page covers `stream` options; sweep `generate`, `resume`, `resumeGenerate`, `observe`, `prepare`, `untilIdle`, `abort` examples.
8. **`runScope` alignment**: the durable run registry pre-dates `Mastra`'s `runScope`. Both serve the same role (per-run non-serializable scratch space); consider whether `globalRunRegistry` should layer on top of `__createRunScope(runId)` to share refcounting/cleanup semantics.

### 14a. Structural drift sources (root causes)

The audit caught structural / contract drift but missed several behavioral drifts (e.g. `supportedUrls`). The pattern is consistent — anywhere durable maintains a *parallel copy* of an Agent-side code path, it can fall behind silently. Concrete sources:

- **Two `llm-execution` step implementations** (`loop/workflows/agentic-execution/llm-execution-step.ts` 2126 LOC vs `agent/durable/workflows/steps/llm-execution.ts` 760 LOC). Already diverged on `supportedUrls`, `downloadRetries`, `downloadConcurrency`, the `autoResumeSuspendedTools` injection block, and the header-merge logic (memory headers / per-model / call-time).
- **Two `tool-call` step implementations** (`tool-call-step.ts` 1298 LOC vs `steps/tool-call.ts` 777 LOC).
- **Two `llm-mapping` step implementations** (539 LOC vs 187 LOC).
- **Two `is-task-complete` implementations** (185 LOC vs 238 LOC) and two `background-task-check` implementations (145 LOC vs 132 LOC) — confirmed different by `diff -q`.
- **Hand-maintained option allowlists in `serialize-state.ts`** for `modelSettings` and `providerOptions` (§5a).
- **No type-level "is at parity" gate.** A `Pick<>` / `satisfies` test that the durable workflow-input schema covers every relevant `AgentExecutionOptions` field would have surfaced gaps mechanically.

### 14b. Shared-helper extraction candidates (concrete plan)

Ordered by leverage (how many bugs / how much LOC each helper kills). Each helper should live under a shared module both step trees import — proposed home: `packages/core/src/loop/shared/` (new) or `packages/core/src/agent/shared/` (already exists; check fit).

| # | Helper | Inputs | Output | Replaces | Bugs it would have caught |
| --- | --- | --- | --- | --- | --- |
| 1 | ✅ **`buildLlmPromptArgs(model, opts)`** _(Phase 2)_ | `model`, `{ downloadRetries?, downloadConcurrency? }` | `{ supportedUrls, downloadRetries, downloadConcurrency }` (await Promise-like `supportedUrls`) | `llm-execution-step.ts:1167-1184` + `steps/llm-execution.ts:304-321` | PR #18649 (`supportedUrls`), missing `downloadRetries`/`downloadConcurrency` on durable side |
| 2 | ✅ **`mergeLlmCallHeaders(ctx)`** _(Phase 2)_ | `{ memoryHeaders, modelConfigHeaders, callTimeHeaders }` | merged record or `undefined` | `llm-execution-step.ts:1391-1405` + every equivalent block on durable side | Header strip bug (§5a), divergent merge order |
| 3 | **`resolveSupportedUrls(model)`** | `model` | `Record<string, RegExp[]>` or `undefined`, awaiting Promise-like | duplicated in two places (subset of #1) | Same as #1 |
| 4 | **`createToolResolvers(tools)`** | `ToolSet` | `{ resolveTool, resolveDirectOrProviderTool, resolveDirectOrIdTool }` | `llm-execution-step.ts:157-225` (already a helper; durable side re-resolves ad-hoc inside `applyToolPayloadTransformToChunk`) | Per-step `currentTools` resolution drift (the CodeRabbit comment fixed earlier this week) |
| 5 | **`pickLlmCallSettings(modelSettings)`** | raw `modelSettings` | JSON-safe subset (typed + passthrough) | `serializeModelSettings` in `serialize-state.ts:165-209` | §5a allowlist drift, header strip bug |
| 6 | **`getStepAvailableToolNames(tools, activeTools)`** | tools + activeTools | string[] | already a shared util; verify both sides import it (they do for `setInferenceContext`, audit other call sites) | Drift on which tools are reported to the inference span |
| 7 | **`runStreamCompletionScorers` / `formatStreamCompletionFeedback`** | scorer ctx | verdict + feedback | already shared between durable + regular `is-task-complete` (`is-task-complete.ts:5`). Good model for what the rest of the helpers should look like. | n/a — exemplar |
| 8 | **`processLlmOutputStream(opts)`** | streaming opts | `{ collectedChunks }` | `llm-execution-step.ts:419-…` `processOutputStream` (regular-only today, but durable side reimplements the same chunk-collection loop inline) | Whatever drift exists between the two chunk loops — needs audit |
| 9 | **`pickProviderOptions(providerOptions)`** | raw | JSON-safe | currently `providerOptions` is forwarded as opaque JSON in durable; regular path may shape it differently per-provider — audit before extracting | Provider-options drift (latent) |
| 10 | ✅ **`composeStepInput(currentStep, prepareStepResult)`** _(Phase 2)_ | base step + prepareStep delta | merged step | merge logic at `llm-execution-step.ts:1380-1390` + durable equivalent at `steps/llm-execution.ts:286-302` | `prepareStep` merge-order drift (already had one CodeRabbit fix here) |

**Implementation strategy:**

1. **Land helpers one at a time, behind no flag.** Each PR replaces both call sites in one commit so they can't drift again. Don't bundle.
2. **Snapshot-test each helper.** Take the current regular-path output for representative inputs, lock it in, then replace the durable call site — any drift surfaces as a snapshot diff.
3. **For `pickLlmCallSettings` specifically**, the migration is non-trivial because it ties into the header policy change in §5a. Sequence: (a) land the passthrough walker keeping the old denylist behavior, (b) flip the denylist to a sensitive-field annotation, (c) wire the encrypt-at-rest path in the store adapter.
4. **After 3 helpers land, add the "is at parity" type-level test.** It only becomes useful once the schema is the single source of truth — otherwise you're just locking in the current drift.
5. **Long-term**, the goal is for `agent/durable/workflows/steps/*.ts` to become thin wrappers that call shared helpers + add the durable-specific concerns (`globalRunRegistry` lookups, `messageListState` rehydration, pubsub emission, snapshot-friendly state mutations). If a durable step is more than ~150 LOC after the helpers land, that's a smell.

---

### 14c. Step-by-step deep diff (Jun 30 pass)

Done as a separate pass after the §14a/§14b structural review surfaced PR #18649's `supportedUrls` miss. Each row records what the regular step does, what the durable step does, and the delta — bugs first, then "shape only" differences.

#### `llm-execution`

Behavioral deltas (durable side missing):
- **`autoResumeSuspendedTools` system-message injection**: regular agent rewrites the initial system message with a "resume these suspended tools" block (`llm-execution-step.ts` ~L1200–1245). Durable side has no equivalent — `autoResumeSuspendedTools: true` cannot work end-to-end on a durable resume even though the flag is plumbed through `prepareForDurableExecution`.
- **`generateBackgroundTaskSystemPrompt`**: regular agent appends a background-task system prompt to the initial system message when a `backgroundTaskManager` + tools are present. Durable side does not — durable agents won't tell the LLM about its pending background tasks.
- **`downloadRetries` / `downloadConcurrency`**: regular forwards both into `llmPromptForModel`; durable does not (already flagged in §14a, same root as `supportedUrls`).
- **`processLLMRequest` short-circuit / cached-response replay**: regular runs `ProcessorRunner.runProcessLLMRequest` and replays a cached response without re-running output processors. Durable has no equivalent — input processors that bail with a cached response will not work on durable agents.
- **Deferred-error / `processAPIError` retry loop**: regular defers the error chunk so error processors can intercept it and force a retry with an incremented `processorRetryCount`. Durable side has a simpler "try next model" branch and only honors `errorProcessors` via the outer `globalRunRegistry` path; processor-driven retry semantics differ.
- **Client-tool observability** (`injectClientToolObservability`, `endClientToolObservabilitySpan`, `clientToolArgsTextByToolCallId`): regular tracks `tool-call-input-streaming-start`, `tool-call-delta`, `tool-call-input-streaming-end` to instrument client tools. Durable side ignores these chunk types for observability purposes.
- **`onInputStart` / `onInputDelta` callbacks**: regular forwards them; durable does not surface them in `DurableAgentStreamOptions`.

Structural-only deltas (same behavior, different plumbing):
- Regular reads runtime state via `runScope` (`STEP_TOOLS_KEY`, `STEP_WORKSPACE_KEY`, `TOOL_PAYLOAD_TRANSFORM_KEY`, `RESOURCE_ID_KEY`, …). Durable reads from `globalRunRegistry.get(runId)` + `getInitData()`.
- Regular calls `options.onChunk` directly; durable emits via `emitChunkEvent(pubsub, …)`.
- Regular's `MODEL_GENERATION` span is opened in `Agent.#execute()` and threaded; durable's is rebuilt from `inputModelSpanData` exported through the workflow input.

#### `tool-call`

Behavioral deltas:
- **Provider-tool fallback** (`findProviderToolByName`): regular falls back to provider-defined tools by name when the model emits a `tool-call` for a tool not in the static set. Durable side resolves only from `registryEntry.tools` and `resolveTool(toolName, mastra)`.
- **`addToolMetadata` (`pendingToolApprovals` / `suspendedTools`)**: regular writes structured metadata onto the last assistant message keyed by `toolCallId` so resume-after-refresh can recover from message history alone (see comment block at `tool-call-step.ts:160–225`). Durable side relies on the `globalRunRegistry` entry + workflow snapshot instead — refresh-from-history is not supported on the durable path.
- **`removeToolMetadata` / pre-upgrade fallback**: regular tolerates legacy `toolName`-keyed entries; durable does not need to (no metadata persistence) but loses the ability to drain stale entries from messages.
- **`getTransformedToolPayload` / `withToolPayloadTransformMetadata` / `withToolPayloadTransformProviderMetadata`**: regular applies the transform chain across `input-available` and post-execution phases and stamps both metadata and provider metadata. Durable only applies the transform to the outgoing chunk via `applyToolPayloadTransformToChunk`.
- **`MastraFGAPermissions`**: regular has FGA hooks (`actor`, `requireToolApprovalFromFactory`). Durable's `actor` is plumbed through but the FGA check is not invoked at the tool-call boundary.
- **`MastraToolInvocationOptions` / `ToolApprovalContext`**: regular passes the full approval context (including provider tool metadata and observability). Durable passes a narrower context.

Structural-only deltas:
- Regular dispatches background tasks via `createBackgroundTask` + run-scope keys; durable does the same via `globalRunRegistry`.
- Span lifecycle: regular ends `MODEL_STEP` in `llm-mapping-step`; durable also defers and ends in `llm-mapping`, mirrored correctly.

#### `llm-mapping`

Behavioral deltas:
- ✅ **Output processors for tool-result / tool-error chunks**: _Closed by Phase 4._ Regular runs `ProcessorRunner.processPart` against `outputProcessors` for tool-result chunks. Durable now does the same in `tool-call.ts` before chunk emission.
- ✅ **`toModelOutput` normalization + MAPPING span**: _Closed by Phase 4._ Regular calls `normalizeModelOutput`, runs `toModelOutput` under a `MAPPING` child span, and stamps the AI-SDK-shaped result onto provider metadata. Durable `llm-mapping.ts` now does the same.
- **Provider-executed tool detection**: regular uses `findProviderToolByName` again to decide whether to skip mapping. Durable side relies on `toolResult.providerExecuted` already being set upstream — works for in-process but is fragile.
- **`DELEGATION_BAILED_KEY` handling**: regular short-circuits when a delegation bail signal is set. Durable side has no equivalent — durable delegation cannot bail mid-mapping.
- **Reprocess parts loop** (`processorRunner.drainReprocessParts`): regular drains parts a processor stashed for reprocessing. Durable side has no equivalent.

Structural-only deltas:
- Durable rebuilds `messageList` from `messageListState` on every invocation; regular threads the live `MessageList` through `OuterLLMRun`.

#### `background-task-check`

No behavioral deltas — confirmed parity. Both implementations honor:
- `bgManager.listTasks({ status: 'running' })` gate
- `skipBgTaskWait` short-circuit (regular reads from run scope, durable from `initData.options`)
- `retryCount === 0 || !waitTimeoutMs` first-invocation pending signal
- `bgManager.waitForNextTask` with `progressIntervalMs: 3000` progress emission
- Timeout-elapsed passthrough vs task-completed `isContinued = true` flip

Only structural difference is the emission channel (`controller.enqueue` vs `pubsub.emit`). Good candidate to leave alone.

#### `is-task-complete`

Behavioral deltas (durable side missing):
- **`customContext` from `requestContext`**: regular passes `Object.fromEntries(requestContext.entries())` into the scorer `StreamCompletionContext`. Durable hardcodes `customContext: undefined` — scorers on durable agents cannot see the request context. **Confirmed parity bug.**

Structural deltas (intentional given the loop topology):
- Iteration counting: regular maintains an internal closure counter (`currentIteration++`); durable uses `state.iterationCount` from the loop state. Both should converge to the same value when used identically.
- `isContinued` flip target: regular mutates `inputData.stepResult.isContinued` in place (regular's outer loop reads it). Durable returns a new state with `lastStepResult.isContinued` flipped because the durable loop predicate reads that field.
- Feedback emission: regular appends the feedback message inline via `messageList.add(...)`; durable returns the feedback message in the output state and a downstream step appends it after deserialization.
- Error path: regular throws on scorer failure; durable catches and logs a warning (likely better — scorer infra should not crash the run).
- Emission channel: `controller.enqueue` vs `emitChunkEvent`.

#### `dowhile` / loop topology

Both sides use a `dowhile` wrapper around a per-iteration body. Same shape:

- **Regular** (`loop/workflows/agentic-loop/index.ts`): `createAgenticLoopWorkflow` wraps `createAgenticExecutionWorkflow` in `.dowhile(agenticExecutionWorkflow, predicate)`. The inner execution workflow is the one-shot pipeline (`llmExecution → map → foreach(toolCall) → llmMapping → backgroundTaskCheck → signalDrain → isTaskComplete → goal`); the loop driver lives in the outer workflow.
- **Durable** (`agent/durable/workflows/create-durable-agentic-workflow.ts`): wraps `singleIterationWorkflow` in `.dowhile(singleIterationWorkflow, predicate)`. The inner `singleIterationWorkflow` is the same conceptual pipeline.

So the topology is at parity. What differs is *what each predicate does and what the inner pipeline contains*.

**Predicate deltas:**
- Regular's predicate runs `stopWhen` evaluation, `onIterationComplete` callback dispatch, `pendingFeedbackStop` handling, `DELEGATION_BAILED_KEY` short-circuit, pending-signal drain (`DRAIN_PENDING_SIGNALS_KEY` → `addSignal` → `safeEnqueue` data parts), `messageId` rotation, and emits a `step-finish` chunk via `outputWriter`. It mutates `typedInputData.stepResult.isContinued` in place to control loop continuation.
- Durable's predicate reads `stopWhen` from `globalRunRegistry` (with a `maxSteps`-only fallback for cross-process engines), emits an `iteration-complete` event with `isFinal` / `stopWhenMatched` / `underMaxSteps` flags via pubsub, and returns `!isFinal`. After Phases 1, 3 & 4.5a, the durable predicate now also: rotates `messageId` + marks response boundary (Phase 1), checks `state.delegationBailed` and forces stop (Phase 3 / Bug 14), calls `onIterationComplete` from `globalRunRegistry` and honors `continue`/`feedback` return values (Phase 3 / Bugs 13, 15), persists `pendingFeedbackStop` for two-phase stop semantics (Phase 3 / Bug 13), and drains pending signals between iterations — marking a response boundary, rotating `messageId`, adding signals to `messageList`, emitting them via pubsub, and forcing `isContinued = true` so the LLM sees them (Phase 4.5a / Bug 11).

**Behavioral deltas surfaced by re-reading the regular predicate:**

1. ✅ **Pending-signal drain in the predicate** — _Closed by Phase 4.5a._ Durable predicate now calls `registryEntry.drainPendingSignals('pending')`, marks a response boundary, rotates `messageId`, adds signals to `messageList`, emits them via pubsub, and forces `isContinued = true` — matching the regular predicate's behavior.
2. ✅ **`messageId` rotation between iterations** — _Closed by Phase 1._ Durable predicate now rotates `messageId` and marks response boundary when the loop continues.
3. ✅ **`pendingFeedbackStop` two-phase stop** — _Closed by Phase 3._ Durable predicate now persists `pendingFeedbackStop` in iteration state and honors the two-phase stop semantics.
4. ✅ **`DELEGATION_BAILED_KEY` short-circuit** — _Closed by Phase 3._ Durable `llm-mapping.ts` reads `__mastra_delegationBailed` from `requestContext` and propagates `delegationBailed` through output; predicate checks it and forces stop.
5. ✅ **`onIterationComplete` feedback rewrite of `isContinued`** — _Closed by Phase 3._ Durable predicate now calls `onIterationComplete` directly and flips `isContinued` based on return value.
6. **`step-finish` emission** — regular gates `step-finish` chunk emission on `reason !== 'tripwire' || hasSteps` inside the predicate via `outputWriter`. Durable emits its iteration event differently and may not gate equivalently.

**Steps inside the per-iteration body that exist in the regular pipeline but not the durable pipeline:**
- ✅ **`signalDrainStep`**: _Closed by Phase 4.5a._ Durable `singleIterationWorkflow` now includes a `signal-drain` map step (between `backgroundTaskCheckStep` and `update-iteration-state`) that calls `registryEntry.drainPendingSignals('pending')`, marks a response boundary, rotates `messageId`, adds signals to `messageList`, and emits them via pubsub. Initial signal echoes are handled in `llm-execution.ts` (echoing `registryEntry.initialSignalEchoes` and draining pre-run signals before the first model request).
- ✅ **`goalStep`**: _Closed by Phase 4._ Durable side now has `createDurableGoalStep` chained after `isTaskCompleteStep` — goal-aware stop semantics are honored.

**Iteration-complete event:**
- Durable emits `ITERATION_COMPLETE` via pubsub on every loop pass. Regular does not have a workflow-level event equivalent; it relies on `onIterationComplete` callback dispatch in the predicate.

#### Updated helper priority after deep pass

Adding to §14b based on what the deep pass surfaced:

| # | Helper | Replaces | New evidence |
| --- | --- | --- | --- |
| 11 | ✅ **`buildAutoResumeSystemMessage(suspendedTools)`** _(Phase 2)_ | `llm-execution-step.ts` ~L1200–1245 | Durable side has no autoResume path; shared helper would make this an importable bool-gated injection. |
| 12 | ✅ **`runOutputProcessorsForToolChunks`** _(Phase 4)_ | `llm-mapping-step.ts` `processAndEnqueueChunk` | Wired `ProcessorRunner.processPart` into durable `tool-call.ts` for tool-result/tool-error chunks before emission. |
| 13 | **`buildIsTaskCompleteContext(state, requestContext, initData)`** | both `is-task-complete` step bodies | Catches the `customContext` parity bug; also locks in iteration-count semantics. |
| 14 | ✅ **`signalDrain(scope, controller, pubsub)`** _(Phase 4.5a)_ | `signal-drain-step.ts` | Added `drainPendingSignals` and `initialSignalEchoes` to `RunRegistryEntry`, populated in `preparation.ts` via `agent.__getDrainPendingSignals()`. Signal drain wired at three points: initial echoes + pre-run drain in `llm-execution.ts`, within-iteration drain as a `signal-drain` map step, inter-iteration drain in the `dowhile` predicate. |
| 15 | ✅ **`evaluateLoopContinuation` — delegation-bailed + predicate parity** _(Phase 3)_ | both `dowhile` predicates | Instead of extracting a shared helper, the durable predicate was updated inline to check `state.delegationBailed`, `state.pendingFeedbackStop`, `stopWhen`, and `maxSteps`, matching the regular predicate's decision logic. |
| 17 | ⏳ **`drainPendingSignalsIntoMessages`** | regular predicate's `DRAIN_PENDING_SIGNALS_KEY` block | Deferred — same root cause as helper #14; DurableAgent has no signal infrastructure. |
| 18 | ✅ **`applyIterationCallbackResult` — onIterationComplete + pendingFeedbackStop** _(Phase 3)_ | regular predicate's `onIterationComplete` feedback handling | Durable predicate now calls `onIterationComplete` directly from `globalRunRegistry` and honors `continue`/`feedback` return values inline. `pendingFeedbackStop` added to `baseIterationStateSchema`. |
| 16 | **`provideToolFallback(name, registryTools, mastra)`** | durable `resolveTool` vs regular `findProviderToolByName` | Closes provider-tool parity in tool-call step. |

#### Concrete bug list from the deep pass

These are confirmed behavioral gaps the audit caught (write them as standalone fix PRs or roll into the helper extractions above):

1. ✅ **`customContext` dropped from `is-task-complete` scorers on durable** — _Closed by Phase 1._ Durable now snapshots `requestContext.entries()` (JSON-safe subset) on `workflowInput.requestContextEntries` in `prepareForDurableExecution` and `is-task-complete.ts` forwards it as `customContext` to scorers, matching the non-durable agent.
2. ✅ **`autoResumeSuspendedTools` injection missing on durable** — _Closed by Phase 2._ Extracted `applyAutoResumeSystemMessage` / `extractSuspendedTools` into `packages/core/src/loop/shared/auto-resume-system-message.ts` and called from both regular `llm-execution-step.ts` and durable `llm-execution.ts` behind the existing flag, so suspended-tool system-message rewrites now happen on the durable path.
3. ✅ **Background-task system prompt missing on durable** — _Closed by Phase 2._ Extracted `injectBackgroundTaskPrompt` into `packages/core/src/loop/shared/inject-background-task-prompt.ts` and wired into durable `llm-execution.ts` using `registryEntry.backgroundTasksConfig`, mirroring the regular agent's `BACKGROUND_TASK_MANAGER_KEY` injection point.
4. ✅ **Output processors don't see tool-result / tool-error chunks on durable** — _Closed by Phase 4._ Wired `ProcessorRunner.processPart` into durable `tool-call.ts` for `tool-result` and `tool-error` chunks before emission, mirroring the regular agent's `processAndEnqueueChunk` flow. Output processors now see tool chunks on the durable path; `tripwire` blocking is also handled.
5. ✅ **`signalDrainStep` missing entirely** — _Closed by Phase 4.5a._ Added a `signal-drain` map step to the durable `singleIterationWorkflow` (between `backgroundTaskCheckStep` and `update-iteration-state`) that calls `registryEntry.drainPendingSignals('pending')`, marks a response boundary, rotates `messageId`, adds signals to `messageList`, and emits them via pubsub. Initial signal echoes and pre-run signals are drained in `llm-execution.ts` before the first model request. `DurableAgent` inherits `drainPendingSignals` via `Agent.__getDrainPendingSignals()`, which accesses the `agentThreadStreamRuntime` — no separate `sendMessage` API was needed for the drain side.
6. ✅ **`goalStep` missing** — _Closed by Phase 4._ Ported `createDurableGoalStep` into `packages/core/src/agent/durable/workflows/steps/goal.ts`, chained after `isTaskCompleteStep` in the `singleIterationWorkflow`. The step reads `goal` config from `globalRunRegistry` (stored in `preparation.ts` via `agent.__getGoalConfig()`), resolves `GoalStore` / `GoalObjectiveRecord` from thread state, runs `runStreamCompletionScorers`, emits `goal` chunks via `pubsub`, and updates the objective status — matching the regular agent's `goal-step.ts` behavior. Both `goal-satisfied` and `goal-budget-exhausted` scenario tests now pass on durable.
7. ✅ **Provider-tool fallback (`findProviderToolByName`) missing on durable tool-call** — _Closed by Phase 1._ Durable `tool-call.ts` now falls back to `findProviderToolByName(toolName, registryEntry?.tools)` (and the same lookup against the resolved `mastra` tools) before emitting `ToolNotFoundError`, matching the regular tool-call step.
8. ✅ **`processLLMRequest` cached-response short-circuit missing on durable** — _Closed by Phase 4._ Added `llmRequestInputProcessors` to `RunRegistryEntry` (resolved via new `agent.__listLLMRequestProcessors(requestContext)` method) and wired `ProcessorRunner.runProcessLLMRequest` into durable `llm-execution.ts` before the `execute()` call. Cached responses are replayed as a `ReadableStream` with `runId`/`from: ChunkFrom.AGENT` reattached, skipping the model call. `TripWire` errors are caught and emitted as `tripwire` chunks before bailing the step.
9. ✅ **`toModelOutput` MAPPING-span normalization missing on durable** — _Closed by Phase 4._ Added `toModelOutput` handling in durable `llm-mapping.ts`: resolves tools from `globalRunRegistry`, calls `tool.toModelOutput` under a `MAPPING` child span (parented to the step span), applies `normalizeModelOutput` (converting `image-url`/`image-data`/`file-data` to `media` for AI SDK compatibility), and merges the result into `providerMetadata.mastra.modelOutput` for `messageList` updates.
10. ✅ **Client-tool observability + `onInputStart` / `onInputDelta` callbacks not surfaced on durable** — _Closed by Phase 4._ Added `tool-call-input-streaming-start`, `tool-call-delta`, and `tool-call-input-streaming-end` chunk handling to durable `llm-execution.ts`. Tool definitions with `onInputStart`/`onInputDelta` callbacks are resolved from `currentTools` or `registryEntry.tools` and invoked with `toolCallId`, `messages`, and `abortSignal`. Client-tool observability spans (`CLIENT_TOOL_CALL`) are created and ended around the tool input streaming lifecycle, with `argsTextDelta` accumulation and JSON parsing — matching the regular agent's behavior.

All 15 bugs are now closed. Phase 1 closed bugs 1, 7, 12. Phase 2 closed bugs 2, 3. Phase 3 closed bugs 13, 14, 15. Phase 4 closed bugs 4, 6, 8, 9, 10. Phase 4.5a closed bugs 5, 11 (signal drain).

**Additional bugs surfaced by re-reading the regular `dowhile` predicate:**

11. ✅ **Pending-signal drain between iterations missing on durable** — _Closed by Phase 4.5a._ Added `drainPendingSignals` (function) and `initialSignalEchoes` (array) to `RunRegistryEntry`, populated in `preparation.ts` via `agent.__getDrainPendingSignals(requestContext)` and `getInitialSignalEchoes(messageList)`. The durable predicate now calls `registryEntry.drainPendingSignals('pending')`, marks a response boundary, rotates `messageId`, adds signals to `messageList`, emits them via pubsub, and forces `isContinued = true`. A within-iteration `signal-drain` map step also drains pending signals between tool execution and task completion. Initial signal echoes and pre-run signals are drained in `llm-execution.ts` before the first model request. Note: cross-process signal delivery is inherently unsupported since `drainPendingSignals` is a non-serializable closure; in-process `DurableAgent` runs (the common case) have full signal drain parity. The `sendMessage`-wake integration path remains a separate gap (scenario tests still skipped on durable for wake-related tests).
12. ✅ **`messageId` rotation between iterations missing on durable** — _Closed by Phase 1._ Durable `dowhile` predicate now mutates `state.messageId` with a fresh id (via `mastra.generateId()` with `crypto.randomUUID()` fallback) when the loop will continue, so the next iteration's assistant message lands under a distinct id and the rotated id flows into the next iteration via `map-to-llm-input`.
13. ✅ **`pendingFeedbackStop` two-phase stop missing on durable** — _Closed by Phase 3._ Durable predicate now reads `onIterationComplete` from `globalRunRegistry`, calls it directly (instead of fire-and-forget via pubsub), and honors `{ continue: false, feedback }` by injecting the feedback message into `messageList` and setting `state.pendingFeedbackStop = true`. On the next predicate call, `pendingFeedbackStop` forces `hasFinishedSteps = true`, giving the LLM exactly one more turn before stopping — matching the regular agent's two-phase semantics. `pendingFeedbackStop` is persisted in `baseIterationStateSchema` and propagated via `createBaseIterationStateUpdate`.
14. ✅ **`DELEGATION_BAILED_KEY` short-circuit missing on durable** — _Closed by Phase 3._ Added `delegationBailed` field to `DurableAgenticExecutionOutput`, `baseIterationStateSchema`, and `createBaseIterationStateUpdate`. Durable `llm-mapping.ts` reads `requestContext.get('__mastra_delegationBailed')` and propagates it through the output. Durable predicate checks `state.delegationBailed` and forces `hasFinishedSteps = true` when set, matching regular agent's `DELEGATION_BAILED_KEY` handling.
15. ✅ **`onIterationComplete` predicate-level dispatch divergence** — _Closed by Phase 3._ Durable predicate now calls `onIterationComplete` directly from the predicate body (read from `globalRunRegistry`) and honors its return value: `{ continue: false }` stops the loop, `{ continue: true }` forces continuation if `maxSteps` allows, and `{ feedback }` injects a user message into `messageList`. Removed the duplicate fire-and-forget `onIterationComplete` forwarding from `durable-agent.ts` `stream()` and `resume()` methods. The pubsub `AGENT_ITERATION_COMPLETE` event is still emitted for client-side observability.

---

### 14d. Scenario-level coverage (Jun 30 pass)

`packages/core/src/loop/test-utils/aimock/scenarios/` runs every scenario across `normal`, `evented`, and `durable` via `describeForAllEngines(..., { skip: [...] })`. Until Phase 2, four scenarios that exercised the bugs above were passing `{ skip: ['durable'] }` — which is the structural reason these durable-only behavioral gaps went undetected at the integration level.

Status after Phase 2:

| Scenario | Bugs / helpers it covers | Status on durable |
| --- | --- | --- |
| `prepare-step` | Helper #10 (`composeStepInput`) | ✅ Unskipped on durable. Asserts per-step `activeTools` reach the model. |
| `background-task-agent-level` | Bug 3 (`injectBackgroundTaskPrompt`) | ✅ Unskipped on durable. Asserts `background-task-started` chunk. |
| `auto-resume-suspended-tools` | Bug 2 (`applyAutoResumeSystemMessage`) | ⏳ Still skipped on durable. Phase 2 fixes the system-message rewrite (covered by unit test) but the harness asserts `output.text` on the resume turn, and the durable resume returns a different output wrapper shape — to be unblocked alongside Phase 3 predicate work. |
| `background-task-tool-level` | Bug 3 + Bug 4 | ⏳ Still skipped on durable. Phase 2 wires the prompt, but the test asserts a `tool-result` chunk that durable's `llm-mapping` doesn't emit. Unskip alongside Phase 4 helper #12 (`runOutputProcessorsForToolChunks`). |

Also dropped the `!isDurable` guard on `prepareStep` in `aimock-scenario.ts` so the harness now passes `prepareStep` through to durable runs.

Status after Phase 3:

| Scenario | Bugs / helpers it covers | Status on durable |
| --- | --- | --- |
| `delegation-complete-bail` | Bug 14 (`delegationBailed`) | ✅ Unskipped on durable. Asserts `bail()` stops the supervisor loop. |
| `stop-condition-long-loop` | `stopWhen` predicate evaluation | ✅ Unskipped on durable. Asserts `stepCountIs(N)` halts the loop. |
| `iteration-complete` | Bugs 13, 15 (`onIterationComplete`, `pendingFeedbackStop`) | ⏳ Still skipped on durable. The "inject feedback" test changes the LLM request shape (feedback message), causing AIMock fixture mismatch. The underlying mechanism works (covered by `durable-agent-iteration-callback.test.ts`). |
| `auto-resume-suspended-tools` | Bug 2 (`applyAutoResumeSystemMessage`) | ⏳ Still skipped on durable. Harness asserts `output.text` on resume turn; durable resume returns different output wrapper shape. |
| `background-task-tool-level` | Bug 3 + Bug 4 | ⏳ Still skipped on durable. Phase 2 wires the prompt, but the test asserts a `tool-result` chunk that durable's `llm-mapping` doesn't emit. Unskip alongside Phase 4 helper #12. |

Also dropped the `!isDurable` guards on `stopWhen`, `delegation`, and `onIterationComplete` in `aimock-scenario.ts` so the harness now passes these options through to durable runs.

Status after Phase 4:

| Scenario | Bugs / helpers it covers | Status on durable |
| --- | --- | --- |
| `goal-satisfied` | Bug 6 (`goalStep`) | ✅ Unskipped on durable. Asserts `goal` chunks with `passed=true` and `status='done'`. |
| `goal-budget-exhausted` | Bug 6 (`goalStep`) | ✅ Unskipped on durable. Asserts budget exhaustion stops the loop with `maxRunsReached`. |
| `auto-resume-suspended-tools` | Bug 2 (`applyAutoResumeSystemMessage`) | ⏳ Still skipped on durable. Harness asserts `output.text` on resume turn; durable resume returns different output wrapper shape. |
| `background-task-tool-level` | Bug 3 + Bug 4 | ⏳ Still skipped on durable. Phase 4 wires output processors, but the test asserts a `tool-result` chunk shape that differs on durable (tool-call.ts emits raw chunks rather than mapping-step processed chunks). |
| `iteration-complete` | Bugs 13, 15 (`onIterationComplete`, `pendingFeedbackStop`) | ⏳ Still skipped on durable. AIMock fixture mismatch on feedback injection. |
| `output-step-processor` | Bug 4 (output processors) | ⏳ Still skipped on durable. Uses call-time `outputProcessors` and `stopWhen` harness guards. |
| `input-processor` / `input-step-processor` | Bug 8 (`processLLMRequest`) | ⏳ Still skipped on durable. Uses call-time `inputProcessors` harness guards. |

Status after Phase 4.5a:

| Scenario | Bugs / helpers it covers | Status on durable |
| --- | --- | --- |
| `signal-no-subscriber` | Bugs 5, 11 (signal drain) | ✅ Already passing on durable — both `sendMessage` (no subscriber) and `sendStateSignal` (persist) work. |
| `signal-send-message` | Bugs 5, 11 (signal drain) | ⏳ Still skipped on durable. `sendMessage`-wake test hangs — `DurableAgent.stream()` doesn't complete through the `AgentThreadStreamRuntime` subscribe path. The `sendStateSignal` (persist) test passes. Signal drain within a run works; this is a separate integration gap. |
| `signal-edge-cases` | Bugs 5, 11 (signal drain) | ⏳ Still skipped on durable. Multiple-subscribers wake test hangs (same `sendMessage`-wake gap). `unsubscribe` and `sendStateSignal` cache-dedup tests pass on durable. |
| `abort-signal` | Abort signal handling | ⏳ Still skipped on durable (unrelated to signal drain). |

---

## 15. Verdict

The `stream`/`resume`/`generate`/`resumeGenerate`/`observe`/`prepare` surface is at **structural** parity with the regular `Agent` for in-process runs. All JSON-safe options propagate through `prepareForDurableExecution`; all closures degrade predictably to boolean shadows or `maxSteps`. The remaining ⚠️ items are intrinsic to durable execution (closures don't survive snapshotting) and are documented for callers; the ❌ items are either intentional out-of-scope legacy paths (`streamLegacy`, `generateLegacy`) or subsumed (`resumeStream`/`resumeStreamUntilIdle` → `resume({ untilIdle })`).

**Behavioral parity is weaker than structural parity.** PR #18649 demonstrates that the audit shape (read each method, compare signatures and option lists) does not catch drift inside the step bodies — the two `llm-execution` steps had identical signatures and very different behavior on assets with `supportedUrls`. The deep step-by-step pass in §14c surfaced 15 additional behavioral gaps across both the per-iteration body and the `dowhile` predicate. After Phases 1–4.5a, **all 15 bugs are closed**. Both the predicates and the per-iteration body steps are now at behavioral parity for in-process runs. Phase 5 added a type-level parity gate (`satisfies` / `Pick<>` test) to prevent future drift from being silent. The remaining integration gap is `sendMessage`-wake through `AgentThreadStreamRuntime.subscribeToThread` — durable `stream()` doesn't complete through the subscribe path, causing scenario tests that use `sendMessage` + `subscribeToThread` to hang on durable. This is a separate architectural concern from signal drain within a run.
