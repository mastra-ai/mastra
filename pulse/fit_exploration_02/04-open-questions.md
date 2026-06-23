# Open Questions

## Shape

### Should config mutations create flows?

Options:

1. Config mutations create lightweight flows.
2. Config mutations create standalone Pulses without a flow.
3. Config mutations are separate revision records, not Pulses.

Current leaning: use lightweight flows only when the config mutation has multiple meaningful observations. A single version creation may not need a full flow object.

### Does Pulse need explicit payload fields?

`attributes` is now carrying:

- runtime input
- runtime output
- error details
- config diffs
- tool definitions
- schemas
- source/actor context

Possible fields:

- `input`
- `output`
- `error`
- `definition`
- `context`

Concern: explicit fields make the shape clearer but may recreate specialized span/event schemas.

### Should `surface` be a closed set?

Current leaning: mostly yes, with extension points.

The surface list should avoid product-area names when a domain name is clearer.

Examples:

- prefer `agent_config` over `agent_builder`
- prefer `tool_config` over `tool_editor`
- prefer `thread` over `memory_thread_storage`

## Action

### Should action be globally closed or closed by surface?

Global action sets will either be too small or too vague.

Current leaning: closed by surface.

Example:

```ts
type PulseActionBySurface = {
  agent: AgentRuntimeAction;
  agent_config: AgentConfigAction;
  tool: ToolRuntimeAction | ToolDefinitionAction;
  thread: ThreadAction;
};
```

### Are `agent_created` and `version_created` both needed?

Maybe only version creation matters because the first version implies creation.

Counterpoint: learning systems may care that an agent entered existence separately from a version snapshot.

## Config Provenance

### Where do internal config IDs live?

Options:

1. `metadata`
2. `attributes`
3. `primitive.versionId`
4. `flow.config`

Current leaning:

- `primitive.versionId` for the version of the primitive directly involved
- `flow.config` for execution-wide config references
- `metadata` for external correlation only

### How much diff detail should be captured?

`changedFields` is compact and already exists. Full before/after diffs are more useful but heavier and more sensitive.

Current leaning: store changed field names and version references in Pulse. Full diff belongs in config/version storage if needed.

## Definitions

### Are definitions Pulses or separate records?

Definition Pulses work for "definition was registered in this flow." They are less convincing as long-term storage for large schemas.

Current leaning:

- define separate definition records keyed by hash/version
- emit a Pulse only when a definition becomes relevant to a flow or changes

### First use or flow start?

Emitting all definitions at flow start may be noisy. First use is leaner.

But first-use emission can make early runtime Pulses harder to interpret if a tool is available but unused.

Current leaning: first use for runtime flows, config mutation for availability changes.

## Threads

### Store `nextFlowId` or derive it?

Current leaning: store `previousFlowId`, derive `nextFlowId`.

Reason: appending is easier and avoids updating prior flow records after the fact.

### How to model regeneration?

Simple `previousFlowId` is not enough for regenerate/edit/branch behavior.

Possible future fields:

- `branchFromFlowId`
- `regenerationOfFlowId`
- `replacesFlowId`

Defer until actual UI semantics are clear.

### Can one turn create multiple flows?

Probably yes for durable background continuation, delegated remote work, or separate inspectable sub-runs.

Open issue: whether these should be child flows, seeded flows, or one flow with long-running progress Pulses.

## Runtime

### Should `MODEL_CHUNK` become `text_chunk_emitted`?

Current leaning: yes conceptually, but preserve aggregation behavior.

Need decide:

- live-only chunks vs persisted chunks
- chunk batching thresholds
- whether final output Pulse also stores accumulated text

### Should stored overrides emit runtime decision Pulses?

Current leaning: yes when they actually apply to a runtime flow.

They explain why the executed agent differs from code-defined config.

## Deferred

- persistence schema
- transport API
- redaction
- exporter mapping
- old trace migration
- UI rendering
- cost/performance controls
