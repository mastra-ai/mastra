---
'@mastra/core': minor
---

Declarative, persistable workflow graphs.

Workflows can now be authored as data — a UI, an LLM, or an operator can construct a workflow and have it survive process restarts. The step graph carries dedicated `agent` / `tool` / `mapping` entries (plus static `parallel` / `foreach` / `sleep` / `sleepUntil`) that round-trip through JSON, persist through the new stored-workflow endpoints, rehydrate, and run.

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

**New workflow-definitions storage domain.** `WorkflowDefinitionsStorage` (`upsert` / `get` / `list` / `delete` on JSON-safe `WorkflowDefinition`s) plus `Mastra.addStoredWorkflow(definition)` for persisting and live-registering a workflow. An in-memory implementation ships in core; database-backed stores provide their own implementations of the same domain interface.

**New (de)serialization helpers.** `toStorableGraph(stepFlow)` turns a live workflow into a JSON-safe graph; `rehydrateWorkflow(def, mastra, opts?)` reconstructs the live workflow (including top-level workflow `metadata`). Referenced agents/tools must be registered on the target `Mastra` at rehydration time — otherwise rehydration hard-crashes rather than silently dropping.

**Two-sided contract for unsupported JSON Schema keywords.** The MVP `jsonSchemaToZod` doesn't support `oneOf` / `anyOf` / `allOf` / `not` / `$ref` / `patternProperties` / `discriminator` (or unknown `type`s):

- **Save path** (`Mastra.addStoredWorkflow`) is strict: the author is right there, so it throws before touching storage or registry, naming the offending schema (`inputSchema`, `outputSchema`, `stateSchema`, `requestContextSchema`, or `step "<id>" outputSchema` reached through `parallel` / `foreach` / `conditional` / `loop`). Simplify the schema or extend the converter before saving.
- **Load path** (boot-time `#loadStoredWorkflows`) is lenient: `jsonSchemaToZod` accepts an `{ onUnsupportedSchema: 'warn', onUnsupported }` option that degrades the unsupported subtree to `z.any()` and emits a warning through the Mastra logger. One bad pre-existing row (e.g. a definition written by an older version) can't take down startup for every other workflow.

**Agent-step `structuredOutput` and JSON-safe options now round-trip.** The serialized `agent` entry carries an `outputSchema` field (JSON Schema Draft 2020-12) and rehydration reconstructs the equivalent `structuredOutput` wiring. `retries` and `metadata` round-trip on both `agent` and `tool` entries. Closure-valued options (`onFinish`, `onChunk`, `onError`, `onStepFinish`, `onAbort`, function-valued `scorers` / `toolChoice`) hard-crash at `toStorableGraph` time instead of silently dropping. This is what makes patterns like `tool → agent-with-array-outputSchema → foreach(agent)` persistable end-to-end.

**`foreach` / `dowhile` / `dountil` inner steps are now `SingleStepEntry`.** Both at the live `stepFlow` level and, for `foreach`, in the serialized graph. Fixes the previous round-trip bug where an agent-bodied `foreach` was persisted as an id-only descriptor and rehydrated as the wrong kind of step (looked up in the tool registry). `foreach.step` preserves the stored step id (which can differ from the underlying agent/tool id), and the agent/tool `outputSchema` + JSON-safe options round-trip through the foreach body. `loop.step` is typed as `SerializedSingleStepEntry` in the serialized graph as well, matching `foreach` and matching the shape the builder actually emits. Mapping entries are rejected inside `foreach` / `parallel` at serialize and rehydrate time — mappings project data, they don't execute per item.

**Mapping templates now accept `${stepResults.<stepId>}` with no subpath, and stringify objects/arrays as JSON.** Primitive step outputs render via `String(v)`; object and array outputs render via `JSON.stringify` and are inlined into the template. This makes `foreach(agent) → mapping → synthesis-agent` work naturally — the mapping hands the full `{ text: string }[]` output to a downstream agent as one JSON blob, instead of forcing callers to fake indexed access (`${stepResults.<id>.0.text}`, `.1.text`, …) up to a fixed slot count. A step whose whole result is nullish is reported as missing (the template throws with the offending placeholder); nullish values resolved from a subpath inside a present result render as empty strings. Unrepresentable values (circular references, `BigInt`) throw with a hint pointing at the placeholder.

**Workflow streams now publish the final workflow result before closing.** Successful runs include the canonical result on the closing `workflow-finish` chunk (`payload.finalWorkflowResult`), so stream-only consumers can read the result without a race-prone second fetch. Non-success and tripwire payloads are unchanged.

**New `Mastra.removeWorkflow(keyOrId)` public API** mirroring `removeAgent` / `removeTool`. `Mastra.addStoredWorkflow(def)` now unregisters any existing live workflow with the same id before rehydrating and re-registering, so re-saving a stored workflow surfaces the new graph immediately instead of being silently no-op'd by `addWorkflow`'s first-write-wins guard. Fixes the stale-workflow bug where `deleteWorkflow` + `addStoredWorkflow` served the previous graph until the process restarted.

**`Mastra.addStoredWorkflow` now performs a registry pre-flight before rehydrating.** Every `agentId` in the graph must resolve via `listAgents()` (and must not collide with a tool id), and every `toolId` must resolve via `listTools()` (and must not collide with an agent id). Previously, invalid or mis-classified ids failed deep inside `rehydrateWorkflow` with a less-actionable error (`Tool with name X not found`, or a silent lookup of an agent id in the tool registry). HTTP callers and direct `addStoredWorkflow` consumers now share one contract with the same actionable error messages.

**One validation domain for stored workflow definitions.** All stored-definition checks now live in `@mastra/core`'s internal `workflows/stored/validate/` modules as a single issue-collecting core (`validateStoredWorkflow(def, registryIndex) → { code, path, message }[]`, plus a throwing `assertValidStoredWorkflow` used by the save path). Structure rules (ids, duplicates, mapping placement, nested-workflow identity, self-reference, declarative-predicate arity), reference checks (with mis-classification swap hints; mappings and declarative predicates may reference any runtime-visible step — including steps inside `parallel` / `conditional` / `foreach` / `loop` containers — and references to unknown steps are rejected before publication), JSON-Schema keyword checks, and the schema-flow type-checker (each step's input checked against the preceding output, foreach item schemas, loop feedback, final output vs. `outputSchema`) all run from the same walker over the serialized graph union. The builder authoring types (`WorkflowBuilderGraphEntry` and friends) from `@mastra/core/workflows/builder` are derived from `SerializedStepFlowEntry` instead of hand-duplicated, so the two can no longer drift. **Behavior change:** `Mastra.addStoredWorkflow` (and therefore `POST /stored/workflows`) now runs the schema-flow analysis with the live registries' schemas at save time — schema-incompatible graphs that previously saved silently are rejected with `incompatible-schema` issues. Boot-time loading of existing stored rows stays lenient.

**New declarative predicate DSL for `.branch()` / `.dowhile()` / `.dountil()`.** Conditional branches and loop conditions can now be authored as a small structural JSON expression instead of (or alongside) a JS closure — the shape that finally lets `conditional` and `loop` step entries round-trip through storage. Nothing about existing closure-based conditions changes: the previous `(ctx) => boolean` overloads still work, still evaluate exactly the way they did, and their `serializedCondition.fn` string is still serialized unchanged.

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

The DSL supports `eq` / `ne` / `lt` / `lte` / `gt` / `gte` / `in` / `notIn` / `exists` / `notExists` / `truthy` / `falsy` and the logical combinators `and` / `or` / `not`. Values are either literals or `{ path: '<scope>.<field>...' }` references — `inputData.*` for the previous step's output, `initData.*` for the workflow's initial input, `stepResults.<id>[.<path>]` for a named earlier step's output (scalar step results resolve with no subpath), and `state.*` for the workflow state slot. Missing paths resolve to `undefined` rather than throwing, so `exists` / `notExists` do what you'd expect. `evaluatePredicate(predicate, context)` and `derivePredicateLabel(predicate)` are exported from `@mastra/core/workflows` for callers that want to reuse the evaluator or render the human-readable summary.

The declarative form is what unlocks persistence for `conditional` and `loop` step entries: their serialized shape now carries a `predicates: Predicate[]` (conditional) / `predicate: Predicate` (loop) field that survives `toStorableGraph` and `rehydrateWorkflow`. Closure-only `.branch()` / `.dowhile()` / `.dountil()` calls remain live-only and continue to throw at `toStorableGraph` time with a message pointing at the predicate DSL. Stored `conditional` / `loop` entries also carry the derived human-readable condition labels (`serializedConditions` / `serializedCondition`) generated from the predicate, so UIs render the same labels for stored and code-authored workflows. Rehydrated `parallel` / `conditional` inner agent steps now preserve `outputSchema` (structured output), `retries`, and `metadata` — previously these were silently dropped on load — and serialize → rehydrate → serialize is idempotent.

**Nested workflows as a first-class serialized step type.** `SerializedSingleStepEntry` and `SerializedStepFlowEntry` gain a new `{ type: 'workflow', id, workflowId, description? }` variant. Any `.then(subWorkflow)` (or nesting inside `parallel` / `conditional` / `foreach` / `dowhile` / `dountil`) now serializes to this variant instead of a generic `type: 'step'` entry, and stored (JSON) workflows can reference other registered workflows by id. The live `stepFlow` is unchanged — `SingleStepEntry` / `StepFlowEntry` still use `type: 'step'` for nested workflows at runtime, so all existing engine code, `component === 'WORKFLOW'` checks, and execution paths continue to work. Rehydration resolves `workflowId` against `mastra.listWorkflows()` and hard-crashes with an actionable error if the reference is missing.

`Mastra.addStoredWorkflow`'s pre-flight `collectRefs` and boot-time `#loadStoredWorkflows` both understand the new variant. Cross-workflow references between stored workflows are supported and load-ordered via a two-pass topological sort with Kahn's algorithm; cycles (including self-reference) are detected and rejected with a "detected cycle: A → B → A" error rather than infinite-looping the rehydrator. This is what makes patterns like `parent-workflow → conditional → { child-workflow-A, child-workflow-B }` seedable end-to-end from JSON.

**Backward compatibility.** Existing `.then(createStep(agent))`, `.then(createStep(tool))`, `.map()`, `.parallel()`, and `.branch()` usages keep working and now emit the new declarative entries automatically. Closure-based `.branch()` / `.dowhile()` / `.dountil()` continue to evaluate exactly as before. Adopt the declarative predicate form only if you want the condition to survive `toStorableGraph` / `rehydrateWorkflow`.
