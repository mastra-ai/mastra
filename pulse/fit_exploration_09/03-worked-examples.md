# Worked Examples

These examples use compact pseudo-objects to test fit. They are not implementation types.

## Agent Controller Inbound Message

```ts
{
  id: "pulse:user-message-1",
  type: "input",
  action: "introduced",
  surface: "agent_controller",
  primitive: { kind: "content", id: "content:user-message-1" },
  attributes: {
    channel: "slack",
    threadId: "thread-123",
    externalMessageId: "msg-456",
  },
  timestamp: "2026-08-10T12:00:00.000Z",
}
```

Relationships:

```ts
[
  { type: "external_parent", from: { kind: "pulse", id: "pulse:user-message-1" }, to: { kind: "external", system: "slack", id: "msg-456" } },
  { type: "introduced_content", from: { kind: "pulse", id: "pulse:user-message-1" }, to: { kind: "content", id: "content:user-message-1" } },
  { type: "included_in_model_input", from: { kind: "content", id: "content:user-message-1" }, to: { kind: "model_input", id: "model_input:run-1-turn-1" } },
]
```

Observation:

- This fits as content-bearing Pulse plus relationships. It avoids exporting the whole session display state.
- `AgentChannels.buildEventContext` creates channel attributes and provider metadata; those are metadata about this content, not a separate export family.

## Follow-Up Queued While Run Is Active

```ts
{
  id: "pulse:follow-up-queued-1",
  type: "state",
  action: "queued",
  surface: "thread_control",
  attributes: {
    reason: "run_active",
    count: 1,
    threadId: "thread-123",
    activeRunId: "run-1"
  },
  timestamp: "2026-08-10T12:00:02.000Z",
}
```

Relationships:

```ts
[
  { type: "queued_signal", from: { kind: "pulse", id: "pulse:follow-up-queued-1" }, to: { kind: "pulse", id: "pulse:user-message-2" } },
  { type: "parent_of", from: { kind: "pulse", id: "pulse:run-1" }, to: { kind: "pulse", id: "pulse:follow-up-queued-1" } },
]
```

Observation:

- This is not the same as `display_state_changed` queued count. The export-worthy fact is that a content-bearing user turn was delayed behind an active run and later drained or requeued.

## Tool Approval Declined By User

```ts
{
  id: "pulse:tool-approval-declined-1",
  type: "decision",
  action: "declined",
  surface: "tool_approval",
  attributes: {
    toolName: "deploy",
    toolCallId: "tool-call-2",
    runId: "run-1",
    reason: "user_declined"
  },
  timestamp: "2026-08-10T12:00:04.000Z",
}
```

Relationships:

```ts
[
  { type: "parent_of", from: { kind: "pulse", id: "pulse:tool-call-2" }, to: { kind: "pulse", id: "pulse:tool-approval-declined-1" } },
]
```

Observation:

- The approval decision is a runtime Pulse. A session-scoped "always allow category" grant would instead be a ChangePulse because it changes behavior for later tools.

## Background Tool Task

```ts
{
  id: "pulse:bg-task-running-1",
  type: "state",
  action: "running",
  surface: "background_task",
  primitive: { kind: "task", id: "task-789" },
  attributes: {
    toolName: "longSearch",
    toolCallId: "tool-call-1",
    runId: "run-1",
    threadId: "thread-123",
  },
  timestamp: "2026-08-10T12:00:05.000Z",
}
```

Relationships:

```ts
[
  { type: "parent_of", from: { kind: "pulse", id: "pulse:tool-call-1" }, to: { kind: "pulse", id: "pulse:bg-task-running-1" } },
  { type: "uses_tool_definition", from: { kind: "pulse", id: "pulse:bg-task-running-1" }, to: { kind: "definition", id: "tool:longSearch@v4" } },
]
```

Observation:

- The lifecycle fact is useful. Pubsub dispatch, worker subscription, and cleanup records are not useful unless retry/recovery changes the task's semantic outcome.

## Background Task Suspended And Resumed

```ts
[
  {
    id: "pulse:bg-task-suspended-1",
    type: "state",
    action: "suspended",
    surface: "task",
    attributes: {
      taskId: "task-789",
      toolCallId: "tool-call-1",
      suspendPayloadRef: "content:suspend-prompt-1"
    },
    timestamp: "2026-08-10T12:00:08.000Z",
  },
  {
    id: "pulse:bg-task-resumed-1",
    type: "state",
    action: "resumed",
    surface: "task",
    attributes: {
      taskId: "task-789",
      toolCallId: "tool-call-1",
      resumeDataRef: "content:resume-answer-1"
    },
    timestamp: "2026-08-10T12:00:30.000Z",
  }
]
```

Relationships:

```ts
[
  { type: "resume_of", from: { kind: "pulse", id: "pulse:bg-task-resumed-1" }, to: { kind: "pulse", id: "pulse:bg-task-suspended-1" } },
  { type: "introduced_content", from: { kind: "pulse", id: "pulse:bg-task-suspended-1" }, to: { kind: "content", id: "content:suspend-prompt-1" } },
]
```

Observation:

- `BackgroundTaskManager` and `buildBackgroundTaskWorkflow` already distinguish suspend, resume, terminal completion, timeout, and cancellation. Pulse should mirror those semantic states, not the internal workflow/pubsub wrapper.

## Skill Metadata Included In Model Input

```ts
{
  id: "pulse:skill-metadata-included-1",
  type: "input",
  action: "included",
  surface: "model_input",
  primitive: { kind: "definition", id: "skill:docs-search@v3" },
  attributes: {
    scope: "run",
    format: "xml",
  },
  timestamp: "2026-08-10T12:00:07.000Z",
}
```

Relationships:

```ts
[
  { type: "uses_definition", from: { kind: "model_input", id: "model_input:run-1-turn-1" }, to: { kind: "definition", id: "skill:docs-search@v3" } },
  { type: "included_in_model_input", from: { kind: "pulse", id: "pulse:skill-metadata-included-1" }, to: { kind: "model_input", id: "model_input:run-1-turn-1" } },
]
```

Observation:

- The skill body belongs in a definition/reference body. The Pulse records that this definition became model-visible for a specific turn.
- `SkillsProcessor` refreshes and injects only on the first step. That makes model input visibility the right boundary, not low-level resolver list/get calls.

## File-Routed Instruction Precedence

```ts
{
  id: "pulse:agent-config-resolved-1",
  type: "state",
  action: "resolved",
  surface: "agent_config",
  attributes: {
    agentId: "support",
    instructionSource: "instructions.ts",
    toolMergePolicy: "config_wins_on_collision",
    skillMergePolicy: "config_wins_on_collision"
  },
  timestamp: "2026-08-10T12:00:00.000Z",
}
```

Relationships:

```ts
[
  { type: "uses_instruction_version", from: { kind: "pulse", id: "pulse:agent-config-resolved-1" }, to: { kind: "definition", id: "agent:support:instructions-ts@hash" } },
  { type: "uses_config_version", from: { kind: "pulse", id: "pulse:agent-config-resolved-1" }, to: { kind: "definition", id: "agent:support:config@hash" } },
]
```

Observation:

- The file router is mostly definition assembly. Warnings about ignored files or collisions matter only if they explain the effective runtime definition.

## Experiment Item With Scorer

```ts
{
  id: "pulse:experiment-item-completed-1",
  type: "state",
  action: "completed",
  surface: "experiment",
  primitive: { kind: "experiment_item", id: "exp-1:item-42" },
  data: {
    retryCount: 1,
  },
  attributes: {
    experimentId: "exp-1",
    itemId: "item-42",
    targetType: "agent",
    targetId: "agent:assistant",
  },
  timestamp: "2026-08-10T12:01:00.000Z",
}
```

Relationships:

```ts
[
  { type: "parent_of", from: { kind: "pulse", id: "pulse:experiment-run-started-1" }, to: { kind: "pulse", id: "pulse:experiment-item-completed-1" } },
  { type: "uses_definition", from: { kind: "pulse", id: "pulse:experiment-item-completed-1" }, to: { kind: "definition", id: "agent:assistant@v7" } },
  { type: "uses_definition", from: { kind: "pulse", id: "pulse:score-recorded-1" }, to: { kind: "definition", id: "scorer:accuracy@v1" } },
  { type: "external_parent", from: { kind: "pulse", id: "pulse:experiment-item-completed-1" }, to: { kind: "external", system: "trace", id: "trace-abc" } },
]
```

Observation:

- Experiment execution fits as runtime Pulses plus definition references. Dataset storage updates and progress bookkeeping should stay out unless they affect execution.

## Schedule Fire Introduces Agent Content

```ts
{
  id: "pulse:schedule-fire-1",
  type: "input",
  action: "introduced",
  surface: "schedule",
  attributes: {
    scheduleId: "agent:reports:daily",
    agentId: "reports",
    triggerKind: "cron",
    scheduledFireAt: "2026-08-10T12:00:00.000Z",
    runId: "run-scheduled-1"
  },
  timestamp: "2026-08-10T12:00:01.000Z",
}
```

Relationships:

```ts
[
  { type: "uses_definition", from: { kind: "pulse", id: "pulse:schedule-fire-1" }, to: { kind: "definition", id: "schedule:agent:reports:daily@v1" } },
  { type: "introduced_content", from: { kind: "pulse", id: "pulse:schedule-fire-1" }, to: { kind: "content", id: "content:scheduled-prompt-1" } },
  { type: "parent_of", from: { kind: "pulse", id: "pulse:schedule-fire-1" }, to: { kind: "pulse", id: "pulse:agent-run-started-scheduled-1" } },
]
```

Observation:

- The schedule trigger row can link UI to `runId`, but the Pulse fact is that a schedule introduced content/started a run. Worker group consumption is infrastructure.

## Non-Emission: Display Mirror

No Pulse:

```ts
{
  type: "display_state_changed",
  displayState: { /* current UI mirror */ },
}
```

Observation:

- A display mirror is a derived UI projection. Exporting it would reintroduce snapshots and duplicate facts already represented by content, approval, suspension, and task lifecycle Pulses.
