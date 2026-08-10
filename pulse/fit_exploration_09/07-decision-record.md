# Decision Record

## Decision

Do not add a branch-refresh export family.

The branch-refresh surfaces fit the existing export family:

```ts
type PulseExport =
  | Pulse
  | Relationship;

type Pulse =
  | ObservationPulse
  | ChangePulse
  | SnapshotPulse;
```

`SnapshotPulse` remains last resort and is not required by this exploration.

## Apply In Initial Spec

Apply if initial Pulse export covers current interactive agent runs:

- Agent Controller/session runtime facts
- channel content introduction and external identity relationships
- Agent Signal routing and model visibility from prior explorations
- follow-up queue/drain/requeue facts
- tool approval required/approved/declined
- tool suspension/resume/cancelled
- abort/run-control facts
- mode/model/subagent-model and session approval policy changes
- skill metadata included in model input
- file-routed definition/config references used by a run
- background task lifecycle when task is linked to a tool call/run
- schedule fire when it introduces content or starts/skips/fails a run
- concrete model route/fallback/provider-option decisions

## Defer

- experiment/eval Pulse mapping, unless eval export is required for initial launch
- full channel platform-history reconstruction
- standalone background task observability unrelated to agent/tool runs
- provider capability table versioning as exported runtime facts
- detailed workflow snapshot reconstruction beyond lifecycle and resume relationships

## Skip

- `display_state_changed` snapshots
- channel rendering and adapter output mechanics
- pubsub subscription setup/teardown
- background task cleanup
- storage progress/bookkeeping updates
- dataset CRUD/list/read operations
- generated provider registry churn

## Relationship Additions To Consider

Promote only if implementation needs reader-specific traversal:

- `stale_approval_for`
- `schedule_triggered`
- `task_result_included_in_model_input`
- `scored_target`
- `queued_follow_up`

Existing relationships cover most cases:

- `introduced_content`
- `included_in_model_input`
- `uses_definition`
- `uses_tool_definition`
- `uses_config_version`
- `parent_of`
- `resume_of`
- `queued_signal`
- `drained_signal`
- `external_parent`

## Source Handoff

The next step is not another broad exploration. It is a line-level implementation audit for the apply surfaces. Use `08-implementation-handoff.md` as the starting checklist:

1. Agent Controller/session events and exact Pulse boundaries.
2. Background task lifecycle emission boundaries.
3. File-routed definition identity/version strategy.
4. Skill metadata model-input anchoring.
5. Schedule-fire content/run linkage.
6. Optional experiment/eval mapping if initial spec includes evaluation export.

## Rationale

The refreshed branch code adds important surfaces, but none of them requires a new envelope like `ControllerExport`, `TaskExport`, or `ExperimentExport`.

The failure mode to avoid is convenience-driven export: wrapping existing events because they exist. Pulse should export facts needed to reconstruct and explain runtime behavior. Derived UI state, transport mechanics, and storage bookkeeping are not those facts.
