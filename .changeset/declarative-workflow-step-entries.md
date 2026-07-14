---
'@mastra/core': minor
'@mastra/react': minor
---

Declarative agent / tool / mapping entries in workflow graphs, plus a JSON-safe workflow storage domain.

**What changed**

- `@mastra/core`:
  - `.agent(agentOrId)` and `.tool(toolOrId)` builder methods now emit dedicated `type: 'agent'` and `type: 'tool'` entries into a workflow's `stepFlow` (live) and `serializedStepFlow` (JSON-safe) instead of an opaque generic `step`. `.map()` mapping entries are likewise emitted as first-class `type: 'mapping'` entries. Existing `.then(createStep(agent))` / `.then(createStep(tool))` / `.map()` builder calls continue to work — they now produce these declarative entries automatically.
  - `SingleStepEntry` is a new union covering `step | agent | tool | mapping` and is now the shape used inside `parallel` and `conditional` `steps` arrays (both live and serialized).
  - `createWorkflow`'s generic parameters are now schema types (`TInputSchema`, `TOutputSchema`, `TStateSchema`) rather than raw runtime types. Existing usage that infers types from the passed schemas is unaffected; any code that explicitly parameterized `createWorkflow<TInput, TOutput>(...)` needs to pass the schemas instead (or drop the explicit generics and let inference handle it).
  - New `WorkflowDefinitionsStorage` storage domain (`upsert` / `get` / `list` / `delete` on JSON-safe `WorkflowDefinition`s) plus `Mastra.addStoredWorkflow(definition)` for persisting and live-registering a workflow definition. In-memory implementation ships in core; store adapters (starting with `@mastra/libsql`) implement the SQL side.
  - New `toStorableGraph(stepFlow)` and `rehydrateWorkflow(def, mastra)` helpers turn a live workflow into a JSON-safe graph and back. Referenced agents/tools must be registered on the target `Mastra` at rehydration time — otherwise rehydration hard-crashes so silent drops don't reach execution. The MVP `jsonSchemaToZod` in that module hard-crashes on unsupported keywords (`oneOf`/`anyOf`/`allOf`/`not`/`$ref`/`patternProperties`/`discriminator` and unknown `type`s) for the same reason.
  - Agent-step `structuredOutput.schema` now round-trips through storage: the serialized `agent` entry carries an `outputSchema` field (JSON Schema Draft 2020-12) and rehydration reconstructs the equivalent `structuredOutput` wiring. This is what makes patterns like `tool → agent-with-array-outputSchema → foreach` persistable end-to-end. The JSON-safe subset of step options (`retries`, `metadata`) also round-trips on both `agent` and `tool` entries. Closure-valued options (`onFinish`, `onChunk`, `onError`, `onStepFinish`, `onAbort`, function-valued `scorers` / `toolChoice`) hard-crash at `toStorableGraph` time rather than silently dropping.
  - `.foreach()` and `.dowhile()` / `.dountil()` now hold their inner step as a `SingleStepEntry` (discriminated `step | agent | tool`) both at the live `stepFlow` level and, for `foreach`, in the serialized graph. This fixes the previous round-trip bug where an agent-bodied `foreach` was persisted as an id-only descriptor and rehydrated as the wrong kind of step (looked up in the tool registry). `foreach.step` now preserves the stored step id (which can differ from the underlying agent/tool id), and the agent/tool `outputSchema` + JSON-safe options round-trip through the foreach body. `loop.step` widening is live-only (still Phase-2 for persistence). Mapping entries are rejected inside `foreach` / `parallel` at serialize and rehydrate time, since mappings project data and don't execute per item.

- `@mastra/react`:
  - `WorkflowStepFactory` now exposes dedicated renderer slots for the new step types: `AgentStep`, `ToolStep`, and `MapStep`. Consumers that render workflow graphs and want native rendering for these entries should provide renderers for these slots; graphs produced by older builders continue to render through the existing `step` slot.

**Why**

Persisting workflows as data — so a Studio builder, an LLM, or an operator can construct a workflow and have it survive a restart — requires the graph to round-trip through JSON. The old opaque `step` shape carried closures that couldn't be serialized. Declarative `agent`/`tool`/`mapping` entries carry only IDs and static mapping configs, which round-trip cleanly and let the runtime resolve live agent/tool references against the `Mastra` instance at execution time (with a fast path for entries that already hold a live reference).

**Usage**

```ts
// Live builder — unchanged public surface, but each entry now carries its
// declarative type so it can be persisted and rehydrated later.
const wf = createWorkflow({ id: 'analyze', inputSchema, outputSchema })
  .agent('writer') // string id — resolved against the Mastra instance at run
  .map({ summary: { step: writerAgent, path: 'text' } })
  .commit();

// Persist + live-register from a definition JSON blob.
await mastra.addStoredWorkflow(definition);
```
