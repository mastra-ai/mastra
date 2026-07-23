---
'@mastra/core': minor
'@mastra/react': minor
'@mastra/pg': minor
'@mastra/mysql': minor
'@mastra/mssql': minor
'@mastra/mongodb': minor
'@mastra/spanner': minor
'@mastra/client-js': minor
'@mastra/server': minor
'@mastra/inngest': patch
'@mastra/memory': patch
'@mastra/code-sdk': patch
'@mastra/libsql': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/livekit': patch
'@mastra/playground-ui': patch
'mastracode': patch
'mastra': patch
---

Declarative, persistable workflow graphs and a `mastracode` workflow builder that can actually compose them.

Workflows can now be authored as data — a Studio UI, an LLM, or an operator can construct a workflow and have it survive process restarts. The step graph carries dedicated `agent` / `tool` / `mapping` entries (plus static `parallel` / `foreach` / `sleep` / `sleepUntil`) that round-trip through JSON, and the `mastracode` workflow-builder sub-agent has been re-taught end-to-end so it produces graphs that persist, rehydrate, and run.

---

## `@mastra/core` — declarative workflow step entries

**New declarative entry types in the step graph.** `.agent(agentOrId)`, `.tool(toolOrId)`, and `.map(...)` now emit dedicated `type: 'agent' | 'tool' | 'mapping'` entries into both `stepFlow` (live) and `serializedStepFlow` (JSON-safe), instead of collapsing into an opaque generic `step`. Existing `.then(createStep(agent))` / `.then(createStep(tool))` / `.map()` calls keep working and are auto-migrated to the new entries. `SingleStepEntry` (a new union of `step | agent | tool | mapping`) is now the shape used inside `parallel` and `conditional` `steps` arrays as well.

Both engines interpret declarative entries per kind at the invoke point (via internal `step-entry` accessors and per-kind entry executors — `getEntryId` / `getEntryWorkflow` are exported for integrations) instead of materializing them into synthetic `Step` objects. The internal deep-import module `@mastra/core/dist/workflows/inner-step` (`getInnerStepId` / `materializeInnerStep`, never part of the public barrel) has been removed.

**New builder ergonomics.**

```ts
// Before: agents/tools were wrapped via createStep and lost their identity in the graph
workflow.then(createStep(myAgent)).then(createStep(myTool));

// After: dedicated builders (createStep still works)
workflow
  .agent(myAgent)                                          // output inferred as { text: string }
  .agent(myAgent, { structuredOutput: { schema } })        // output inferred from the schema
  .tool(myTool)                                            // output inferred from the tool's outputSchema
  .agent(myAgent, undefined, { id: 'reviewer' })           // reuse the same agent under a distinct step id
  .agent('my-registered-agent-id');                        // resolved against the Mastra instance at run time
```

`.tool()` and `.agent()` enforce input/output schema chaining the same way `.then()` does — mismatched chains are compile-time errors. Agent steps type their input as `{ prompt: string }`.

**New workflow-definitions storage domain.** `WorkflowDefinitionsStorage` (`upsert` / `get` / `list` / `delete` on JSON-safe `WorkflowDefinition`s) plus `Mastra.addStoredWorkflow(definition)` for persisting and live-registering a workflow. In-memory implementation ships in core; SQL adapters land in the store packages (see `@mastra/libsql` below).

**New (de)serialization helpers.** `toStorableGraph(stepFlow)` turns a live workflow into a JSON-safe graph; `rehydrateWorkflow(def, mastra, opts?)` reconstructs the live workflow. Referenced agents/tools must be registered on the target `Mastra` at rehydration time — otherwise rehydration hard-crashes rather than silently dropping.

**Two-sided contract for unsupported JSON Schema keywords.** The MVP `jsonSchemaToZod` doesn't support `oneOf` / `anyOf` / `allOf` / `not` / `$ref` / `patternProperties` / `discriminator` (or unknown `type`s):

- **Save path** (`Mastra.addStoredWorkflow`) is strict: the author is right there, so it throws before touching storage or registry, naming the offending schema (`inputSchema`, `outputSchema`, `stateSchema`, `requestContextSchema`, or `step "<id>" outputSchema` reached through `parallel` / `foreach` / `conditional` / `loop`). Simplify the schema or extend the converter before saving.
- **Load path** (boot-time `#loadStoredWorkflows`) is lenient: `jsonSchemaToZod` accepts an `{ onUnsupportedSchema: 'warn', onUnsupported }` option that degrades the unsupported subtree to `z.any()` and emits a warning through the Mastra logger. One bad pre-existing row (e.g. a definition written by an older version) can't take down startup for every other workflow.

**Agent-step `structuredOutput` and JSON-safe options now round-trip.** The serialized `agent` entry carries an `outputSchema` field (JSON Schema Draft 2020-12) and rehydration reconstructs the equivalent `structuredOutput` wiring. `retries` and `metadata` round-trip on both `agent` and `tool` entries. Closure-valued options (`onFinish`, `onChunk`, `onError`, `onStepFinish`, `onAbort`, function-valued `scorers` / `toolChoice`) hard-crash at `toStorableGraph` time instead of silently dropping. This is what makes patterns like `tool → agent-with-array-outputSchema → foreach(agent)` persistable end-to-end.

**`foreach` / `dowhile` / `dountil` inner steps are now `SingleStepEntry`.** Both at the live `stepFlow` level and, for `foreach`, in the serialized graph. Fixes the previous round-trip bug where an agent-bodied `foreach` was persisted as an id-only descriptor and rehydrated as the wrong kind of step (looked up in the tool registry). `foreach.step` preserves the stored step id (which can differ from the underlying agent/tool id), and the agent/tool `outputSchema` + JSON-safe options round-trip through the foreach body. `loop.step` is typed as `SerializedSingleStepEntry` in the serialized graph as well, matching `foreach` and matching the shape the builder actually emits. Mapping entries are rejected inside `foreach` / `parallel` at serialize and rehydrate time — mappings project data, they don't execute per item.

**Mapping templates now accept `${stepResults.<stepId>}` with no subpath, and stringify objects/arrays as JSON.** Primitive step outputs render via `String(v)`; object and array outputs render via `JSON.stringify` and are inlined into the template. This makes `foreach(agent) → mapping → synthesis-agent` work naturally — the mapping hands the full `{ text: string }[]` output to a downstream agent as one JSON blob, instead of forcing callers to fake indexed access (`${stepResults.<id>.0.text}`, `.1.text`, …) up to a fixed slot count. `null` / `undefined` render as empty strings; unrepresentable values (circular references, `BigInt`) throw with a hint pointing at the placeholder.

**New `Mastra.removeWorkflow(keyOrId)` public API** mirroring `removeAgent` / `removeTool`. `Mastra.addStoredWorkflow(def)` now unregisters any existing live workflow with the same id before rehydrating and re-registering, so re-saving a stored workflow surfaces the new graph immediately instead of being silently no-op'd by `addWorkflow`'s first-write-wins guard. Fixes the stale-workflow bug where `deleteWorkflow` + `addStoredWorkflow` served the previous graph until the process restarted.

**`Mastra.addStoredWorkflow` now performs a registry pre-flight before rehydrating.** Every `agentId` in the graph must resolve via `listAgents()` (and must not collide with a tool id), and every `toolId` must resolve via `listTools()` (and must not collide with an agent id). Previously, invalid or mis-classified ids failed deep inside `rehydrateWorkflow` with a less-actionable error (`Tool with name X not found`, or a silent lookup of an agent id in the tool registry). The check produces the same error messages the `mastracode` `save-workflow` tool used to emit locally, so HTTP callers, the SDK tool, and direct `addStoredWorkflow` consumers now share one contract.

**New declarative predicate DSL for `.branch()` / `.dowhile()` / `.dountil()`.** Conditional branches and loop conditions can now be authored as a small structural JSON expression instead of (or alongside) a JS closure — the shape that finally lets `conditional` and `loop` step entries round-trip through storage. Nothing about existing closure-based conditions changes: the previous `(ctx) => boolean` overloads still work, still evaluate exactly the way they did, and Studio still renders their `serializedCondition.fn` string unchanged.

Opt in by passing `{ predicate }` in place of the closure:

```ts
import type { Predicate } from '@mastra/core/workflows'

workflow
  .then(loadUser)
  .branch([
    [
      { predicate: { op: 'eq', left: { path: 'inputData.role' }, right: 'admin' } },
      adminStep,
    ],
    [
      { predicate: { op: 'truthy', value: { path: 'inputData.isGuest' } } },
      guestStep,
    ],
  ])
  .commit()

workflow
  .then(tick)
  .dountil(tick, { predicate: { op: 'gte', left: { path: 'inputData.count' }, right: 3 } })
  .commit()
```

The DSL supports `eq` / `ne` / `lt` / `lte` / `gt` / `gte` / `in` / `notIn` / `exists` / `notExists` / `truthy` / `falsy` and the logical combinators `and` / `or` / `not`. Values are either literals or `{ path: '<scope>.<field>...' }` references — `inputData.*` for the previous step's output, `initData.*` for the workflow's initial input, `stepResults.<id>[.<path>]` for a named earlier step's output (scalar step results resolve with no subpath), and `state.*` for the workflow state slot. Missing paths resolve to `undefined` rather than throwing, so `exists` / `notExists` do what you'd expect. `evaluatePredicate(predicate, context)` and `derivePredicateLabel(predicate)` are exported from `@mastra/core/workflows` for callers that want to reuse the evaluator or render the human-readable summary that Studio picks up.

The declarative form is what unlocks persistence for `conditional` and `loop` step entries: their serialized shape now carries a `predicates: Predicate[]` (conditional) / `predicate: Predicate` (loop) field that survives `toStorableGraph` and `rehydrateWorkflow`. Closure-only `.branch()` / `.dowhile()` / `.dountil()` calls remain live-only and continue to throw at `toStorableGraph` time with a message pointing at the predicate DSL. Stored `conditional` / `loop` entries also carry the derived human-readable condition labels (`serializedConditions` / `serializedCondition`) generated from the predicate, so Studio renders the same labels for stored and code-authored workflows. Rehydrated `parallel` / `conditional` inner agent steps now preserve `outputSchema` (structured output), `retries`, and `metadata` — previously these were silently dropped on load — and serialize → rehydrate → serialize is idempotent.

**Nested workflows as a first-class serialized step type.** `SerializedSingleStepEntry` and `SerializedStepFlowEntry` gain a new `{ type: 'workflow', id, workflowId, description? }` variant. Any `.then(subWorkflow)` (or nesting inside `parallel` / `conditional` / `foreach` / `dowhile` / `dountil`) now serializes to this variant instead of a generic `type: 'step'` entry, and stored (JSON) workflows can reference other registered workflows by id. The live `stepFlow` is unchanged — `SingleStepEntry` / `StepFlowEntry` still use `type: 'step'` for nested workflows at runtime, so all existing engine code, `component === 'WORKFLOW'` checks, and execution paths continue to work. Rehydration resolves `workflowId` against `mastra.listWorkflows()` and hard-crashes with an actionable error if the reference is missing.

`Mastra.addStoredWorkflow`'s pre-flight `collectRefs` and boot-time `#loadStoredWorkflows` both understand the new variant. Cross-workflow references between stored workflows are supported and load-ordered via a two-pass topological sort with Kahn's algorithm; cycles (including self-reference) are detected and rejected with a "detected cycle: A → B → A" error rather than infinite-looping the rehydrator. This is what makes patterns like `parent-workflow → conditional → { child-workflow-A, child-workflow-B }` seedable end-to-end from JSON.

---

## `@mastra/react` — renderer slots for the new step types

`WorkflowStepFactory` now exposes dedicated renderer slots: `AgentStep`, `ToolStep`, and `MapStep`. Consumers that render workflow graphs and want native rendering for the new entries should provide renderers for these slots; graphs produced by older builders continue to render through the existing `step` slot.

---

## `@mastra/server` — stored-workflow HTTP endpoints hardened

**`DELETE /stored/workflows/:storedWorkflowId` now unregisters the live workflow instance** in addition to removing the stored row. Previously the handler only called `store.delete(id)`, leaving the rehydrated `Workflow` on `Mastra` until the process restarted — the same stale-registration bug that was fixed for the `mastracode` `deleteWorkflow` service. The handler now calls `mastra.removeWorkflow(id)` after `store.delete`. Idempotent on missing ids.

**`POST /stored/workflows` body schema is now a typed discriminated union.** The `graph` field was previously typed as `z.array(z.any())` and would only surface malformed entries deep inside `rehydrateWorkflow`. It is now a discriminated union over `type: 'step' | 'agent' | 'tool' | 'mapping' | 'parallel' | 'foreach' | 'sleep' | 'sleepUntil'`, matching the shape the `save-workflow` tool emits. Combined with the new `Mastra.addStoredWorkflow` pre-flight, invalid ids, mis-classified refs, and JSON Schemas that use converter-unsupported keywords (`oneOf` / `anyOf` / …) are rejected at the HTTP boundary with actionable errors before rehydration runs. `inputSchema` / `outputSchema` / `stateSchema` / `requestContextSchema` remain `z.any()` — they're JSON Schema Draft 2020-12 blobs, validated in `addStoredWorkflow` before the row is persisted.

**`foreach.opts` is now optional on both sides of the wire.** Previously the Zod schema declared `opts` optional but the underlying `SerializedForeachEntry.opts` was required, forcing a `Parameters<Mastra['addStoredWorkflow']>[0]` cast in the handler that defeated compile-time drift detection. `SerializedForeachEntry.opts` is now optional in core, the Zod schema and the runtime type agree, and the handler cast is gone. Runtime unchanged (engine already read `entry.opts?.concurrency ?? 1`).

**`conditional` and `loop` entries now round-trip through `POST /stored/workflows`.** The body schema's discriminated union has been extended with `type: 'conditional'` (`steps: SingleStepEntry[]`, `predicates: Predicate[]`) and `type: 'loop'` (`step: SingleStepEntry`, `loopType: 'dowhile' | 'dountil'`, `predicate: Predicate`), where `Predicate` is the same structural JSON shape now exported from `@mastra/core/workflows`. Legacy closure-based `serializedConditions` payloads are rejected at the HTTP boundary rather than silently reaching the rehydrator.

**Nested workflow references now round-trip through `POST /stored/workflows`.** The body schema's `SingleStepEntry` union gains a `type: 'workflow'` variant (`id`, `workflowId`, optional `description`) that can appear at the top level or inside any composite entry. `serializedStepFlowEntrySchema` (returned by `GET /workflows/:id`) mirrors the same variant so Studio sees nested-workflow steps in code-defined workflows as well. End-to-end test coverage in `packages/server/src/server/handlers/stored-workflows.test.ts` seeds a child stored workflow, POSTs a parent that references it, and runs the parent through the standard workflow endpoints.

**New HTTP-layer test coverage in `packages/server/src/server/handlers/stored-workflows.test.ts`.** End-to-end coverage for list / get / upsert / delete, including agent `outputSchema` round-trip, `foreach(agent)` rehydration, scalar `${stepResults.<id>}` templating, registry pre-flight rejecting unregistered / mis-classified refs, replace-on-re-upsert, DELETE removing both the stored row and the live registration, and end-to-end declarative-predicate execution for a stored `loop(dountil)` and a stored `conditional` (both rehydrated from JSON and run through the standard workflow endpoints).

---

## `@mastra/pg`, `@mastra/mysql`, `@mastra/mssql`, `@mastra/mongodb`, `@mastra/spanner` — `workflowDefinitions` domain

Implement the `workflowDefinitions` storage domain for pg, mysql, mssql, mongodb, and spanner. Previously the stored-workflow persistence path (agent-builder `POST /stored/workflows`, `save-workflow` / `list-workflows` / `delete-workflow` tools, `Mastra.addStoredWorkflow`) only worked against `@mastra/libsql`. Every other adapter returned `undefined` from `storage.getStore('workflowDefinitions')` and threw when the HTTP handler or SDK tool tried to read/write a workflow.

Each adapter now ships a `WorkflowDefinitions*` domain that:

- Creates the shared `mastra_workflow_definitions` table (or Mongo collection) from `WORKFLOW_DEFINITIONS_SCHEMA` during `init()`, plus a default index on `status`.
- Implements `upsert` / `get` / `list` / `delete` matching `WorkflowDefinitionsStorage` semantics (`list` supports `status` and `authorId` filters and orders by `updatedAt` desc).
- Round-trips the JSON columns (`inputSchema`, `outputSchema`, `stateSchema`, `requestContextSchema`, `metadata`, `graph`) through each adapter's JSON handling, so declarative workflow graphs authored via the builder rehydrate identically no matter which backend they were stored in.

Exported class names by adapter: `WorkflowDefinitionsPG`, `WorkflowDefinitionsMySQL`, `WorkflowDefinitionsMSSQL`, `MongoDBWorkflowDefinitionsStore`, `WorkflowDefinitionsSpanner`. The composite stores (`PostgresStore`, `MySQLStore`, `MSSQLStore`, `MongoDBStore`, `SpannerStore`) auto-wire the new domain, so callers do not need to construct it manually — `storage.getStore('workflowDefinitions')` now returns a live handle.

The pg adapter reads `createdAt` / `updatedAt` from the auto-added `createdAtZ` / `updatedAtZ` `timestamptz` companion columns to avoid the naive-timestamp / local-TZ drift that a plain `TIMESTAMP` read exhibits under node-pg.

---

## `@mastra/memory` — thread-scoped processors skip when there is no thread

`observational-memory` and `working-memory-state` are only attached to `getInputProcessors` / `getOutputProcessors` when `requestContext`'s `MastraMemory` payload carries a `thread.id`. Previously the factories always attached the processors, which then threw at runtime with "requires Mastra memory with an active resourceId and threadId" the moment they ran without a thread. Ephemeral agent invocations (workflow agent steps, sub-agent tool calls) don't have — and don't need — a persistent chat thread, so the correct behavior when no thread is present is to no-op, not to throw and abort the call.

---

## `@mastra/code-sdk` (`mastracode`) — workflow-builder sub-agent rewrite

**`withEphemeralMemory` no longer strands inner agent invocations without a thread id.** The helper that isolates workflow-agent-step memory used to swap in a fresh `MastraMemory` object but delete the reserved `MASTRA_THREAD_ID_KEY` from the request context. Inner agent invocations (e.g. `foreach(agent)` iterations) resolve their runtime thread through that reserved key — not through `MastraMemory` — so `prepare-memory-step` built a `MessageList` with `threadId: undefined`, and downstream storage saves failed with "Thread ID is required". The helper now stamps both `MASTRA_THREAD_ID_KEY` and `MASTRA_RESOURCE_ID_KEY` to the ephemeral ids for the lifetime of `fn`, then restores or deletes them.

**`workflowBuilderAgent` was taught the new `workflow` step type for composing stored workflows out of other stored workflows.** Its instructions describe how to reference an existing workflow by id (`{ type: 'workflow', id, workflowId, description? }`), how the input/output contract works (the outer step's input becomes the sub-workflow's `initData`, its final output becomes the outer step's output), and how nested workflows compose inside `parallel` / `conditional` / `foreach` / `loop`. A new companion tool `list-available-workflows` returns the id / description / input+output schemas for every registered workflow (code-defined and stored) so the sub-agent can discover reusable sub-workflows the same way it discovers agents and tools. A new anti-pattern calls out reaching for the `workflow` step type to inline a small chain that would be simpler as a few extra steps in the parent.

**`workflowBuilderAgent` was taught the full static step subset — including `conditional` and `loop` via the new predicate DSL.** Its instructions now document `parallel`, `foreach`, static `sleep`, static `sleepUntil`, plus `conditional` (branch selection via `predicates: Predicate[]`) and `loop` (`dowhile` / `dountil` via `predicate: Predicate`) alongside the existing `agent` / `tool` / `mapping` step types, including their exact JSON shapes and the rule that `foreach` inputs must be arrays. A dedicated "Conditional branches and loops — declarative predicates" section walks the sub-agent through the DSL shape (`op` / `and` / `or` / `not`, `PathOrLiteral` scopes: `inputData`, `initData`, `stepResults.<id>`, `state`) and the guarantee that `.branch()` fires the first matching case. The `save-workflow` tool's `graph` field schema and description now enumerate every emittable discriminant so the LLM sees the full supported subset when it constructs a workflow. Dynamic `sleep(fn)` / `sleepUntil(fn)` variants remain the only out-of-scope step shapes.

**`workflowBuilderAgent` no longer teaches `${inputData.<field>}` as a shortcut for workflow input.** The prompt previously described `inputData` as "the WORKFLOW's input object" for all steps. That is only true for step 1 — after step 1 the engine binds `inputData` to the previous step's output, so `${inputData.<workflowInputField>}` templates silently reference the wrong scope. The prompt now teaches the correct three-scope model:

- `${initData.<field>}` — the workflow's initial input, valid from any step.
- `${inputData.<field>}` — the previous step's output, valid only when that output is known to be an object with that field.
- `${stepResults.<id>[.<path>]}` — a named earlier step's output; scalar step results resolve with no subpath.

Anti-patterns and worked examples were updated to match, and a new `foreach → summary` example demonstrates threading workflow input through `${initData.path}` from a mapping step.

**`workflowBuilderAgent` now knows templates JSON-encode objects and arrays.** The prompt used to teach that templates render primitives only and would throw on object/array values, pushing the builder toward workarounds like fake indexed access (`${stepResults.foreach-id.0.text}`, `.1.text`, …) up to a fixed slot count, or bailing out of `foreach` entirely in favor of a single agent that "loops internally". With the core template runtime now JSON-encoding non-primitive placeholders, the builder is taught to write bare `${stepResults.<foreach-id>}` when handing a fan-out's `{ text }[]` result into a synthesis agent. New worked example: `list → mapping → bridge-agent-with-array-outputSchema → foreach(agent) → mapping-with-JSON-encoded-array → synthesis-agent`. The old indexed-slot approach is now an explicit anti-pattern.

**`workflowBuilderAgent` now has a clearer rule for adding a bridge agent before `foreach`.** When the upstream step's top-level output is not already an array (typical for string-returning workspace tools like `find_files`), the previous guidance said to "ask for a tool that returns the array or fall back to a single code-agent that iterates internally" — which the builder correctly followed by opting out of `foreach`. The updated prompt promotes the bridge pattern instead: insert an `agent` step between the string/object-returning upstream and the `foreach`, with `outputSchema` set to an array (typically `Array<{ prompt: string }>` when the inner foreach step is an agent). A new anti-pattern calls out refusing `foreach` in this situation.

**`workflowBuilderAgent` now knows to thread `${initData.*}` into bridge mappings when the upstream tool strips context.** Tools like `find_files` return bare basenames — no path prefix — so a downstream agent asked to "read and summarize each file" has no way to reconstruct absolute paths from just the tool output. The builder was writing mappings that piped only `${stepResults.list-files}` into the bridge agent, and the resulting workflow failed at the per-file summariser step ("file not found"). The prompt now includes: (a) an anti-pattern calling out this exact failure mode, (b) a "combining upstream output with workflow input" worked example that shows a mapping referencing BOTH `${initData.path}` and `${stepResults.<upstream>}` in the same template, and (c) updated foreach worked examples where the bridge mapping threads `${initData.path}` and the bridge agent's `outputSchema` prompts embed the absolute path per iteration.

**`save-workflow` now defers registry validation to `Mastra.addStoredWorkflow`.** The tool used to walk the graph itself and pre-check every `agentId` / `toolId` before calling `addStoredWorkflow`. That check now lives on `Mastra`, so the tool is a thin passthrough — HTTP callers and the SDK tool share one contract, and the identical error messages surface to the sub-agent unchanged.

**`create-workflow` no longer silently returns a fake success when the sub-agent gives up.** The parent-mode `create-workflow` tool used to return `{ summary, workflowId }` regardless of whether the workflow-builder sub-agent actually called `save-workflow` or whether `save-workflow` threw. The sub-agent's natural-language summary would happily say "workflow created!" while nothing was persisted, and the caller had no signal — `list-workflows` would come back empty. `create-workflow.execute` now watches the sub-agent's full tool stream and throws when: (a) `save-workflow` was never called (sub-agent hallucinated success), (b) `save-workflow` emitted a `tool-error` chunk, or (c) `save-workflow` was called but no result with `{ ok: true, id }` came back. The thrown error includes every `tool-error` the sub-agent produced (not just the save error) plus the sub-agent's own summary. Six new unit tests in `mastracode/sdk/src/tools/workflows/__tests__/create-workflow.test.ts` cover each failure mode.

**`/workflows show` now renders the inner step of a `foreach` / `loop` / `parallel` / `conditional` container.** Previously the diagram only printed the entry `type` (e.g. `foreach`, `loop`) with no indication of what was being iterated or fanned out. Container entries have no top-level `id` in the serialized graph, so linear-graph titles like `4. (unnamed)` were misleading. The renderer now synthesizes a container title from the inner step (`foreach(summarise-one)`, `dowhile(check)`, `parallel`, `conditional`), prints the container header line (`foreach — concurrency 3`, `parallel — 2 branches`, `dountil`), and lists each inner step on its own line with its kind and agent/tool id.

---

## Backward compatibility

Existing `.then(createStep(agent))`, `.then(createStep(tool))`, `.map()`, `.parallel()`, and `.branch()` usages keep working and now emit the new declarative entries automatically. Closure-based `.branch()` / `.dowhile()` / `.dountil()` continue to evaluate exactly as before. Adopt the declarative predicate form only if you want the condition to survive `toStorableGraph` / `rehydrateWorkflow`.
