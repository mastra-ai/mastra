# Event Family Fit Matrix

This matrix starts from the applicability review and tests how each event family fits into Pulse.

## Initial Families

| Family | Primitive Fit | Suggested `type`s | Shape Notes | Initial Verdict |
| --- | --- | --- | --- | --- |
| Agent run lifecycle | agent | `input`, `decision`, `progress`, `output`, `error` | Root Pulse should usually be agent input/run accepted. Child Pulses represent model/tool/processor/scorer work. | Apply |
| Model calls | agent, workflow, scorer, processor, tool | `input`, `decision`, `output`, `error`, `progress` | Routing/auth/transport are `decision` children of the model call, not separate roots. | Apply |
| Tool execution | agent, workflow | `input`, `decision`, `state`, `output`, `error`, `progress` | Tool call can have input validation, approval, suspend/resume, execution, stream output, output validation. | Apply |
| Workflow execution | workflow | `input`, `decision`, `state`, `output`, `error`, `progress` | Step Pulses are children. Suspend/resume and retry/replay are `state`/`decision`. | Apply |
| Processor execution | agent, workflow | `input`, `decision`, `state`, `output`, `error` | State-signal processors are `state`; filtering/transform processors may be `decision` and `output`. | Apply |
| Scorer/eval | scorer/eval, agent/workflow | `input`, `decision`, `output`, `error`, `progress` | Scorer score belongs in `data.score`; scorer reason in `text` or `attributes.reason`. | Apply |
| Memory during run | agent, processor | `decision`, `state`, `output`, `error` | Emit from agent/memory processor, not storage domain. Avoid repeating message payloads. | Apply at caller |
| State signals | agent, processor | `state`, `decision`, `error` | Snapshot vs delta is `decision`; emitted signal is `state`. | Apply |
| Harness | agent-facing adapter | `input`, `state`, `output`, `error`, `progress` | Only when harness carries user work into/out of agent or owns durable run state. Skip admin session CRUD. | Apply selectively |
| Channels | agent-facing adapter | `input`, `decision`, `output`, `error`, `progress` | Platform ingress/egress applies. Installation/config CRUD skips. | Apply selectively |
| A2A | agent/subagent | `input`, `decision`, `state`, `output`, `error`, `progress` | Remote task polling and input-required are very Pulse-shaped. | Apply |
| Code Mode | tool | `input`, `progress`, `output`, `error`, `decision` | Runner logs can be `progress` or `output` depending on whether they are intermediate or final. | Apply |
| Sandbox/process | tool/workspace tool | `decision`, `progress`, `output`, `error` | Only when executing a user tool/command/code-mode run. Generic sandbox lifecycle skips. | Apply selectively |
| Tool provider runtime | agent/tool | `decision`, `error` | Runtime materialization for a run applies. Catalog listing/admin connection fields skip. | Apply at caller |
| Integration OpenAPI tool | tool | `input`, `output`, `error` | Generated tool execution applies; static/dynamic listing generally skip. | Apply selectively |
| Storage domains | primitive-owned state only | `state`, `error` | Emit from caller as state persisted/failed. Do not emit storage CRUD directly. | Apply at caller |
| Observability storage/query | none | none | Query/navigation APIs are not primitive work. | Skip |
| Server/auth/session | mostly none | `error` only if primitive denied | Admin/server plumbing skips. Primitive denial can surface as a run error. | Skip/defer |
| License/feature/telemetry | none | none | Org/product telemetry. | Skip |
| Agent Builder/admin policy | none initially | none | UI/admin derivation. Runtime denial in primitive path can be a later error Pulse. | Skip |

## Event Name Fit

The raw audit names are valuable, but they should not become top-level `type`.

Working convention:

```ts
attributes: {
  event: '<family>.<thing>.<phase>',
  surface: '<agent|workflow|tool|model|processor|scorer|memory|harness|channel|a2a|code_mode>',
}
```

Examples:

| Raw Audit Candidate | Pulse `type` | `attributes.event` |
| --- | --- | --- |
| `tool.execute_started` | `input` | `tool.execute.started` |
| `tool.execute_completed` | `output` | `tool.execute.completed` |
| `tool.execution_failed` | `error` | `tool.execute.failed` |
| `model_stream.transport_resolved` | `decision` | `model.transport.resolved` |
| `task_state_signal.snapshot_emitted` | `state` | `state_signal.snapshot.emitted` |
| `a2a.task_poll_scheduled` | `progress` | `a2a.task.poll_scheduled` |
| `experiment_item.retry_scheduled` | `progress` | `eval.item.retry_scheduled` |
| `observability_storage.entities_discovered` | none | skip |

## Boundary Decisions

### Start/End Pairs

Do not automatically create start/end pairs for every candidate. Use paired Pulses only when both points communicate distinct facts.

Good pair:

- `model.call.started`: captures prompt/model/settings input.
- `model.call.completed`: captures usage/output.

Weak pair:

- `storage.domain_read.started`
- `storage.domain_read.completed`

The storage pair should usually be skipped or collapsed into one primitive-level `state` or `error` Pulse if it affects execution.

### Decision Pulses

Decision Pulses are useful when they explain branching.

Good:

- model router selected transport
- tool approval required
- state signal emitted snapshot instead of delta
- A2A stream fell back to buffered generate
- experiment item retry scheduled

Bad:

- admin picker visibility resolved
- observability storage feature list returned
- logger selected transport for log listing

### Progress Pulses

Progress should be bounded. Avoid one Pulse per tiny chunk unless users need that granularity.

Potential strategy:

- stream `text-start`: `progress`
- selected deltas: maybe not persisted by default
- stream `text-end`: `progress` or `output`
- aggregate chunk counts in final `output.data`

Open issue: whether Pulse should support high-volume streaming mode separately from persisted Pulse storage.

