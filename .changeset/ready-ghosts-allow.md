---
'@mastra/core': minor
'@mastra/react': minor
'@mastra/client-js': patch
'@mastra/inngest': patch
'@mastra/server': patch
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

**New (de)serialization helpers.** `toStorableGraph(stepFlow)` turns a live workflow into a JSON-safe graph; `rehydrateWorkflow(def, mastra)` reconstructs the live workflow. Referenced agents/tools must be registered on the target `Mastra` at rehydration time — otherwise rehydration hard-crashes rather than silently dropping. The MVP `jsonSchemaToZod` in that module hard-crashes on unsupported JSON Schema keywords (`oneOf` / `anyOf` / `allOf` / `not` / `$ref` / `patternProperties` / `discriminator` and unknown `type`s) for the same reason.

**Agent-step `structuredOutput` and JSON-safe options now round-trip.** The serialized `agent` entry carries an `outputSchema` field (JSON Schema Draft 2020-12) and rehydration reconstructs the equivalent `structuredOutput` wiring. `retries` and `metadata` round-trip on both `agent` and `tool` entries. Closure-valued options (`onFinish`, `onChunk`, `onError`, `onStepFinish`, `onAbort`, function-valued `scorers` / `toolChoice`) hard-crash at `toStorableGraph` time instead of silently dropping. This is what makes patterns like `tool → agent-with-array-outputSchema → foreach(agent)` persistable end-to-end.

**`foreach` / `dowhile` / `dountil` inner steps are now `SingleStepEntry`.** Both at the live `stepFlow` level and, for `foreach`, in the serialized graph. Fixes the previous round-trip bug where an agent-bodied `foreach` was persisted as an id-only descriptor and rehydrated as the wrong kind of step (looked up in the tool registry). `foreach.step` preserves the stored step id (which can differ from the underlying agent/tool id), and the agent/tool `outputSchema` + JSON-safe options round-trip through the foreach body. `loop.step` widening is live-only (persistence still needs Phase-2 predicate DSL). Mapping entries are rejected inside `foreach` / `parallel` at serialize and rehydrate time — mappings project data, they don't execute per item.

**Mapping templates now accept `${stepResults.<stepId>}` with no subpath, and stringify objects/arrays as JSON.** Primitive step outputs render via `String(v)`; object and array outputs render via `JSON.stringify` and are inlined into the template. This makes `foreach(agent) → mapping → synthesis-agent` work naturally — the mapping hands the full `{ text: string }[]` output to a downstream agent as one JSON blob, instead of forcing callers to fake indexed access (`${stepResults.<id>.0.text}`, `.1.text`, …) up to a fixed slot count. `null` / `undefined` render as empty strings; unrepresentable values (circular references, `BigInt`) throw with a hint pointing at the placeholder.

**New `Mastra.removeWorkflow(keyOrId)` public API** mirroring `removeAgent` / `removeTool`. `Mastra.addStoredWorkflow(def)` now unregisters any existing live workflow with the same id before rehydrating and re-registering, so re-saving a stored workflow surfaces the new graph immediately instead of being silently no-op'd by `addWorkflow`'s first-write-wins guard. Fixes the stale-workflow bug where `deleteWorkflow` + `addStoredWorkflow` served the previous graph until the process restarted.

**Breaking-ish generic-signature change on `createWorkflow`.** Its generic parameters are now schema types (`TInputSchema`, `TOutputSchema`, `TStateSchema`) rather than raw runtime types. Existing usage that infers types from the passed schemas is unaffected. Any code that explicitly parameterized `createWorkflow<TInput, TOutput>(...)` needs to pass the schemas instead — or drop the explicit generics and let inference handle it.

---

## `@mastra/react` — renderer slots for the new step types

`WorkflowStepFactory` now exposes dedicated renderer slots: `AgentStep`, `ToolStep`, and `MapStep`. Consumers that render workflow graphs and want native rendering for the new entries should provide renderers for these slots; graphs produced by older builders continue to render through the existing `step` slot.

---

## `@mastra/memory` — thread-scoped processors skip when there is no thread

`observational-memory` and `working-memory-state` are only attached to `getInputProcessors` / `getOutputProcessors` when `requestContext`'s `MastraMemory` payload carries a `thread.id`. Previously the factories always attached the processors, which then threw at runtime with "requires Mastra memory with an active resourceId and threadId" the moment they ran without a thread. Ephemeral agent invocations (workflow agent steps, sub-agent tool calls) don't have — and don't need — a persistent chat thread, so the correct behavior when no thread is present is to no-op, not to throw and abort the call.

---

## `@mastra/code-sdk` (`mastracode`) — workflow-builder sub-agent rewrite

**`withEphemeralMemory` no longer strands inner agent invocations without a thread id.** The helper that isolates workflow-agent-step memory used to swap in a fresh `MastraMemory` object but delete the reserved `MASTRA_THREAD_ID_KEY` from the request context. Inner agent invocations (e.g. `foreach(agent)` iterations) resolve their runtime thread through that reserved key — not through `MastraMemory` — so `prepare-memory-step` built a `MessageList` with `threadId: undefined`, and downstream storage saves failed with "Thread ID is required". The helper now stamps both `MASTRA_THREAD_ID_KEY` and `MASTRA_RESOURCE_ID_KEY` to the ephemeral ids for the lifetime of `fn`, then restores or deletes them.

**`workflowBuilderAgent` was taught the full static step subset.** Its instructions now document `parallel`, `foreach`, static `sleep`, and static `sleepUntil` alongside the existing `agent` / `tool` / `mapping` step types, including their exact JSON shapes and the rule that `foreach` inputs must be arrays. The `save-workflow` tool's `graph` field description now enumerates every emittable discriminant so the LLM sees the full static subset when it constructs a workflow. `conditional`, `loop` (`dowhile` / `dountil`), and dynamic `sleep(fn)` / `sleepUntil(fn)` variants are explicitly marked out of scope — those still need the Phase-2 predicate DSL.

**`workflowBuilderAgent` no longer teaches `${inputData.<field>}` as a shortcut for workflow input.** The prompt previously described `inputData` as "the WORKFLOW's input object" for all steps. That is only true for step 1 — after step 1 the engine binds `inputData` to the previous step's output, so `${inputData.<workflowInputField>}` templates silently reference the wrong scope. The prompt now teaches the correct three-scope model:

- `${initData.<field>}` — the workflow's initial input, valid from any step.
- `${inputData.<field>}` — the previous step's output, valid only when that output is known to be an object with that field.
- `${stepResults.<id>[.<path>]}` — a named earlier step's output; scalar step results resolve with no subpath.

Anti-patterns and worked examples were updated to match, and a new `foreach → summary` example demonstrates threading workflow input through `${initData.path}` from a mapping step.

**`workflowBuilderAgent` now knows templates JSON-encode objects and arrays.** The prompt used to teach that templates render primitives only and would throw on object/array values, pushing the builder toward workarounds like fake indexed access (`${stepResults.foreach-id.0.text}`, `.1.text`, …) up to a fixed slot count, or bailing out of `foreach` entirely in favor of a single agent that "loops internally". With the core template runtime now JSON-encoding non-primitive placeholders, the builder is taught to write bare `${stepResults.<foreach-id>}` when handing a fan-out's `{ text }[]` result into a synthesis agent. New worked example: `list → mapping → bridge-agent-with-array-outputSchema → foreach(agent) → mapping-with-JSON-encoded-array → synthesis-agent`. The old indexed-slot approach is now an explicit anti-pattern.

**`workflowBuilderAgent` now has a clearer rule for adding a bridge agent before `foreach`.** When the upstream step's top-level output is not already an array (typical for string-returning workspace tools like `find_files`), the previous guidance said to "ask for a tool that returns the array or fall back to a single code-agent that iterates internally" — which the builder correctly followed by opting out of `foreach`. The updated prompt promotes the bridge pattern instead: insert an `agent` step between the string/object-returning upstream and the `foreach`, with `outputSchema` set to an array (typically `Array<{ prompt: string }>` when the inner foreach step is an agent). A new anti-pattern calls out refusing `foreach` in this situation.

**`workflowBuilderAgent` now knows to thread `${initData.*}` into bridge mappings when the upstream tool strips context.** Tools like `find_files` return bare basenames — no path prefix — so a downstream agent asked to "read and summarize each file" has no way to reconstruct absolute paths from just the tool output. The builder was writing mappings that piped only `${stepResults.list-files}` into the bridge agent, and the resulting workflow failed at the per-file summariser step ("file not found"). The prompt now includes: (a) an anti-pattern calling out this exact failure mode, (b) a "combining upstream output with workflow input" worked example that shows a mapping referencing BOTH `${initData.path}` and `${stepResults.<upstream>}` in the same template, and (c) updated foreach worked examples where the bridge mapping threads `${initData.path}` and the bridge agent's `outputSchema` prompts embed the absolute path per iteration.

**`create-workflow` no longer silently returns a fake success when the sub-agent gives up.** The parent-mode `create-workflow` tool used to return `{ summary, workflowId }` regardless of whether the workflow-builder sub-agent actually called `save-workflow` or whether `save-workflow` threw. The sub-agent's natural-language summary would happily say "workflow created!" while nothing was persisted, and the caller had no signal — `list-workflows` would come back empty. `create-workflow.execute` now watches the sub-agent's full tool stream and throws when: (a) `save-workflow` was never called (sub-agent hallucinated success), (b) `save-workflow` emitted a `tool-error` chunk, or (c) `save-workflow` was called but no result with `{ ok: true, id }` came back. The thrown error includes every `tool-error` the sub-agent produced (not just the save error) plus the sub-agent's own summary. Six new unit tests in `mastracode/sdk/src/tools/workflows/__tests__/create-workflow.test.ts` cover each failure mode.

**`/workflows show` now renders the inner step of a `foreach` / `loop` / `parallel` / `conditional` container.** Previously the diagram only printed the entry `type` (e.g. `foreach`, `loop`) with no indication of what was being iterated or fanned out. Container entries have no top-level `id` in the serialized graph, so linear-graph titles like `4. (unnamed)` were misleading. The renderer now synthesizes a container title from the inner step (`foreach(summarise-one)`, `dowhile(check)`, `parallel`, `conditional`), prints the container header line (`foreach — concurrency 3`, `parallel — 2 branches`, `dountil`), and lists each inner step on its own line with its kind and agent/tool id.

---

## Backward compatibility

Existing `.then(createStep(agent))`, `.then(createStep(tool))`, `.map()`, `.parallel()`, and `.branch()` usages keep working and now emit the new declarative entries automatically. The only breaking-ish surface is the `createWorkflow` generic-signature change described above.
