# Harness V1 Fit

Detailed candidates are in:

- `pulse/code_audit/12-harness-agent-config-pulse-candidates.md`

This file focuses on shape fit.

## Event Families

| Harness Family | Pulse Family Fit | Notes |
| --- | --- | --- |
| user message/send signal | Strong | Input Pulse plus flow/thread relationship. |
| run start/end | Moderate | Useful boundaries, but avoid span-style duplication. |
| message update | Weak direct fit | Read-model snapshot. Use chunks/changes instead. |
| tool call/result | Strong | Core runtime Pulse sequence. |
| approval required/responded | Strong | Execution gate and human decision. |
| suspension/resume | Strong | Needs Pulse, Change, and Relationship together. |
| task_updated | Moderate | Better as Change operations than full task list pulse. |
| OM lifecycle | Moderate/strong | Progress/data pulses plus context changes when memory modifies context. |
| subagent activity | Strong | Same root flow, explicit parent/subagent relationships. |
| display_state_changed | Reject | UI read model. |

## Suspension Pattern

Harness suspension is the clearest multi-export case:

1. `Pulse(suspension.created)` records the execution point.
2. `Change(harness_pending.pending_item_created)` records durable pending state.
3. `Pulse(suspension.resumed)` records the later response.
4. `Relationship(resume_of)` links resumed flow/pulse to suspended pulse.

If reduced family cannot represent this cleanly, the model is too small.

## Subagent Pattern

Subagents should not create separate roots by default.

Candidate links:

- parent tool call Pulse `subagent.called`
- child flow relationship `subagent_of`
- child text/tool/result pulses under the same root flow or linked sub-flow

Open question:

- Whether subagent execution should have its own `flowId` under the same root, or be represented as a nested segment of the parent flow.

## Harness Config And Mode Changes

Mode/model changes can be runtime-significant, but many are session/UI state changes.

Rule:

- If a mode/model change affects the next or current agent run, emit a config/context `Change`.
- If it is merely UI state with no execution, defer or skip.
- A plan approval that triggers mode transition should link the decision Pulse to the mode/config Change.

## Message Updates

`message_update` is the wrong Pulse source because it repeatedly emits a growing message snapshot.

Better:

- `Pulse(model.text_chunk)`
- `Pulse(model.reasoning_chunk)`
- `Pulse(tool.called)`
- `Pulse(tool.returned)`
- `Change(context.message_finalized)` if needed for reconstruction

