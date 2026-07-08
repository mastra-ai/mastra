# Family Fit Matrix

| Family | Source | Surface | Primitive Fit | Suggested Type | Suggested Action | Shape Notes | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| User signal accepted | `Session.sendSignal`, `createProcessorSendSignal`, `signalDrainStep` | `signal` | agent/thread flow | `input` | `accepted` | Runtime observation. Keep content as content ref or small payload, not full message array. | Apply |
| State signal snapshot | `agent/state-signals.ts` | `context` or `signal` | agent/thread context | `state` plus `Change` | `state_snapshot_applied` | The transcript signal is observable, but the version/cache-key mutation is better as `Change`. | Apply selectively |
| State signal delta | `agent/state-signals.ts` | `context` or `signal` | agent/thread context | `state` plus `Change` | `state_delta_applied` | Delta belongs in `Change.operations`, not as a separate export shape. | Apply selectively |
| Signal provider subscription | `signals/signal-provider.ts` | `signal_provider` | agent/thread subscription | n/a | `subscription_created` | This is a durable relationship between thread and external resource. Better as `Change` or `Relationship`, not Pulse unless runtime behavior changes. | Apply selectively |
| Signal provider notification | `signals/signal-provider.ts` | `signal` | agent/thread flow | `input` | `notification_received` | Observable runtime input. Useful for learning why a flow woke up. | Apply |
| Task signal tools | `TaskSignalProvider`, task tools | `task` | agent/task list | `state` plus `Change` | `task_updated` | Harness currently emits whole task list. Pulse should export task list change operations. | Apply selectively |
| Harness agent start/end | `session-run-engine.ts` | `agent` | agent flow | `progress` | `run_started`, `run_finished` | Useful as flow boundaries, but avoid start/end span recreation. End can carry usage/status when meaningful. | Apply selectively |
| Harness message start/update/end | `session-run-engine.ts` | `message` or `content` | agent flow | `output` | `text_chunk`, `reasoning_chunk`, `message_finalized` | Do not export `message_update` snapshots. Prefer stream chunks or buffered content pulses. | Apply at source |
| Harness tool call/result | `session-run-engine.ts` | `tool` | tool call | `decision` / `output` / `error` | `called`, `returned`, `failed` | Good Pulse family. Tool definition/schema should be referenced, not repeated. | Apply |
| Harness tool approval required | `session-run-engine.ts`, `SessionApproval` | `tool_approval` | tool call | `decision` | `required` | User-facing gate affects execution. Pulse-worthy. | Apply |
| Harness tool approval response | `Session.respondToToolApproval` | `tool_approval` | tool call | `input` / `decision` | `approved`, `declined` | Decision affects execution. Could be Pulse plus relationship to pending item. | Apply |
| Harness tool suspension | `tool-call-suspended`, `SessionSuspensions` | `suspension` | tool call | `decision` | `suspended`, `resumed` | Strong fit. Existing pending storage maps to `Change` or `Relationship`. | Apply |
| Harness plan approval | `respondToToolSuspension`, `handlePlanApprovalResume` | `plan` | tool call / mode | `decision` | `approved`, `rejected` | Approval can also trigger mode switch. Need relationship from plan decision to resumed flow. | Apply |
| Harness mode/model changed | `SessionMode`, `SessionModel` | `harness_config` | session/thread | n/a | `mode_changed`, `model_changed` | Configuration provenance. Better as `Change` unless it happens mid-flow and explains execution. | Config provenance |
| Harness thread created/switched/deleted | `SessionThread` | `thread` | thread | n/a | `created`, `selected`, `deleted` | Thread lifecycle is not necessarily agent primitive execution. Flow/thread relationships are more important. | Apply selectively |
| Harness state changed | `SessionState` | `harness_state` | session | n/a | `changed` | App state may be useful if it affects agent behavior. Otherwise skip. | Apply selectively |
| Harness usage update | `step-finish` | `model` | model step | `progress` | `usage_recorded` | Numeric usage belongs in `data`. Provider specifics in attributes. | Apply |
| Harness info/error | `session-run-engine.ts` | many | many | `system` / `error` | varied | Generic info is too UI-oriented. Errors that affect execution are Pulse-worthy. | Apply selectively |
| Harness workspace status | `harness.ts` | `workspace` | workspace | `system` | `ready`, `failed` | Only Pulse-worthy if workspace is part of the agent execution surface. | Defer |
| Harness OM status/progress | `session-run-engine.ts` | `memory` | agent memory | `progress` / `state` | `observation_started`, `reflection_finished`, etc. | Existing OM lifecycle has useful data; avoid UI `om_status` snapshots unless they become bounded snapshots. | Apply selectively |
| Harness subagent activity | `session-run-engine.ts`, subagent tool | `agent` | subagent flow | `input` / `output` / `progress` | `subagent_started`, `text_chunk`, `tool_called`, `finished` | Strong fit. Usually same root flow, with relationship to parent tool call. | Apply |
| Harness task_updated | `types.ts` | `task` | task list | `state` | `updated` | Current event emits full list. Better as `Change.operations`. | Apply selectively |
| Harness display_state_changed | `SessionBus` | UI | none | n/a | n/a | Read-model artifact. Do not Pulse. | Skip |
| MessageList add/remove/clear | `MessageList`, `ProcessorRunner` | `context` | agent context | n/a | `message_added`, `message_removed`, `context_cleared` | Strong source for context `Change`; avoid exporting final message array. | Apply selectively |
| MessageList serializeForSpan | `message-list.ts` | tracing | none | n/a | n/a | Current tracing compatibility artifact. Do not preserve shape. | Skip |
| MessageHistory recall/save | `processors/memory/message-history.ts` | memory | agent memory | `state` / `progress` | `history_recalled`, `history_saved` | Storage ops themselves are less interesting than context effects and counts. | Apply at caller |

