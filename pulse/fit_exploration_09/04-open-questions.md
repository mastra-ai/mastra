# Open Questions

## Initial Spec Boundary

- Agent Controller sessions look like initial-spec requirements if Pulse export is expected to explain current interactive runs. If initial Pulse only targets lower-level agent/thread runtime, Agent Controller can be a second integration, but the shape does not need to change.
- Background tasks should be included in the initial spec only for tool/run-linked lifecycle. Standalone task-manager observability can wait.
- Experiments/evals can be second-wave unless Pulse launch needs evaluation history. The source shape fits without changing the export family.

## Shape

- Should `surface` use source-ish values (`agent_controller`, `background_task`, `experiment`) or more generic values (`agent`, `task`, `eval`)?
- Should `background_task.output` be content-bearing, progress-only, or both depending on payload?
- Approval policy changes should be ChangePulses even when session-only; open question is whether the scope name is `session`, `thread`, or `run`.
- Do follow-up queue events use `signal_queue` vocabulary or a separate `thread_control` surface?

## Definitions

- What is the identity/version source for file-routed agent definitions: file path + content hash, deploy version, or generated agent version id?
- Can inline or generated skills get stable enough definition IDs for relationship-based reconstruction?
- Should provider capability tables be definitions, or should only effective model settings be exported?
- Should schedule definitions use the schedule row id/version, file path/content hash, or both?

## Relationships

- Which relationship names are canonical versus exploration-local examples?
- Is `included_in_model_input` sufficient for skill metadata and channel content, or does skill metadata need a separate `definition_visible_to_model` edge?
- How should a background task result connect back to the model input turn that eventually sees it?
- Does stale approval need a relationship to the original approval-required Pulse, or is runId/toolCallId enough metadata?
- Should experiment item completion link to target trace via `external_parent`, `scored_trace`, or a more specific relationship?

## Source Coverage

- Which Agent Controller events are durable enough to export directly?
- Where should background task Pulses be emitted: manager, workflow step, tool-call caller, or stream consumer?
- Where should experiment/scorer Pulses be emitted so observer callbacks and storage writes do not double-count?
- Should schedule-fired agent messages use the Agent Signal mapping directly, or a schedule-specific content-introduced Pulse that then wakes a run?

## Deferred Implementation

- Can source instrumentation reuse current event emitters, or does Pulse need separate write points?
- What minimal indexes are needed to query branch-refresh surfaces without adding exported Flow records?
- How should privacy/redaction apply to channel content, skill metadata, and experiment inputs?
