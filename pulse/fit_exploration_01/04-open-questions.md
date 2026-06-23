# Open Questions

## Shape Questions

### Do we need a first-class event name?

The current shape has `type`, but `type` is intentionally semantic and coarse. The audit needs stable names like:

- `tool.execute.started`
- `model.transport.resolved`
- `state_signal.snapshot.emitted`
- `a2a.task.input_required`

For now examples use `attributes.event`.

Concern:

- If `event` stays free-form in attributes, queries and docs may fragment.
- If `event` becomes top-level, Pulse shape gets more opinionated but likely easier to use.

Possible options:

1. Keep `attributes.event`.
2. Add top-level `name`.
3. Rename `type` to `kind` and add `type` as specific event name.
4. Keep `type` semantic and add `eventType` or `name`.

Current leaning: add top-level `name` later if examples keep needing it.

### Is `level` useful?

Worked examples only needed `level` for warning/error-ish progress, like retry scheduled.

Concern:

- `level` may recreate log filtering.
- But without it, alerting/filtering for error-adjacent decisions may require parsing `type` and `attributes`.

Current leaning: keep optional `level`, but never use it to define structure.

### How should high-volume stream chunks work?

Streaming can produce many candidate Pulses.

Options:

1. Persist every chunk Pulse.
2. Emit chunk Pulses only to live subscribers, aggregate in stored output Pulse.
3. Persist start/end and sampled chunks.
4. Treat stream chunks as child data outside Pulse.

Current leaning: do not persist every token/text delta by default. Persist stream start/end and aggregate counts, with optional live-only progress Pulses.

### Should nested primitives create new roots?

Examples can link model/tool calls as children under an agent root.

Question:

- If an agent calls another agent, should the nested agent have its own `rootId` with `seedId`, or remain in the same root?

Current leaning:

- Same root for internal child work.
- New root with `seedId` for delegated executions that can outlive or be inspected independently, such as remote A2A, durable child harness, or separately resumed workflow.

## Scope Questions

### Is RAG ingestion a primitive?

`rag_ingestion` is not in the main primitive list, but it behaves like user-initiated runtime work.

Options:

1. Include it as `surface: 'rag'` in initial Pulse.
2. Defer until agent/tool/workflow paths call it.

Current leaning: include only when invoked as part of user runtime work or explicit user ingestion operation, not as generic storage/vector plumbing.

### Are task tools primitives or tool details?

Task tools are tools, but their state is special because it shapes model behavior.

Current leaning:

- Emit both tool-call Pulses and task/state Pulses.
- Avoid duplicating the full task list on both. Tool output says what happened; state Pulse carries counts/mode and maybe compact state details.

### Where do memory Pulses originate?

Memory can be called directly through APIs or internally by agent processors.

Current leaning:

- Initial Pulse should originate from agent/processor-owned memory activity.
- Direct memory admin APIs are out of scope unless they are part of a run.

## Naming Questions

### Surface names

Candidate `attributes.surface` values:

- `agent`
- `workflow`
- `tool`
- `model`
- `processor`
- `scorer`
- `eval`
- `memory`
- `signal`
- `state_signal`
- `harness`
- `channel`
- `a2a`
- `code_mode`

Question:

- Should `memory` be a surface, or only `state` under an agent/processor surface?

Current leaning: allow `memory` as a surface when the memory subsystem is the direct actor, but parent it under agent/processor.

### Event naming convention

Working pattern:

```txt
<surface>.<noun>.<phase>
```

Examples:

- `agent.run.accepted`
- `model.transport.resolved`
- `tool.execute.started`
- `tool.execute.completed`
- `tool.suspended`
- `state_signal.snapshot.emitted`
- `eval.item.retry_scheduled`
- `a2a.task.input_required`

Question:

- Should phases be a closed set?

Candidate phases:

- `accepted`
- `started`
- `completed`
- `failed`
- `resolved`
- `selected`
- `scheduled`
- `emitted`
- `skipped`
- `suspended`
- `resumed`
- `denied`

Current leaning: keep phase vocabulary small.

## Data Questions

### Should booleans ever go in `data`?

Current answer: no. `data` should stay numeric.

Booleans go in attributes:

```ts
attributes: {
  approval: { required: true }
}
```

### Should scores go in `data`?

Yes, if numeric and current at the pulse:

```ts
data: { score: 0.82 }
```

Reason text should be `text` or `attributes.reason`, depending on whether it is primary human narrative or structured model output.

### Where does usage go?

Flatten numeric usage into `data`:

```ts
data: {
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
}
```

Provider-specific nested usage details go in `attributes.usageDetails` if needed.

## Implementation Questions Deferred

- What API emits a Pulse?
- How do we avoid emission overhead in hot streaming paths?
- How does Pulse coexist with current observability exporters?
- Does Pulse storage use existing observability storage or new tables?
- How are old spans/logs/metrics viewed as Pulses during migration?
- How do privacy/redaction rules apply to `text`, `attributes`, and model/tool payloads?

