# Worked Pulse Examples

These examples test whether audited events fit the current Pulse shape.

All ids are illustrative. Timestamps are placeholders.

## Agent Run

Raw source:

- `agent.run_started`
- model/tool/processor children from multiple audit files
- `agent.run_completed`

Fit:

```ts
{
  timestamp: '2026-06-18T10:00:00.000Z',
  type: 'input',
  text: 'Agent research-agent accepted a run.',
  attributes: {
    event: 'agent.run.accepted',
    surface: 'agent',
    primitive: { type: 'agent', id: 'research-agent' },
    input: { source: 'user' },
  },
  metadata: {
    requestId: 'req_123',
  },
  id: { rootId: 'trace-compatible-root', pulseId: 'p_agent_001' },
  links: {},
}
```

Completion:

```ts
{
  timestamp: '2026-06-18T10:00:02.000Z',
  type: 'output',
  text: 'Agent research-agent completed the run.',
  data: {
    inputTokens: 1240,
    outputTokens: 312,
    totalToolCalls: 2,
  },
  attributes: {
    event: 'agent.run.completed',
    surface: 'agent',
    finishReason: 'stop',
  },
  id: { rootId: 'trace-compatible-root', pulseId: 'p_agent_009' },
  links: { parent: 'p_agent_001', prev: 'p_tool_008' },
}
```

Observation:

- This works without a duration field.
- Token counts fit `data`.
- `finishReason` is not numeric, so it belongs in `attributes`.

## Model Transport Decision

Raw source:

- `model_stream.transport_resolved`

Fit:

```ts
{
  timestamp: '2026-06-18T10:00:00.420Z',
  type: 'decision',
  text: 'Model router selected websocket transport.',
  attributes: {
    event: 'model.transport.resolved',
    surface: 'model',
    model: {
      provider: 'openai',
      id: '__GATEWAY_OPENAI_MODEL__',
    },
    transport: 'websocket',
    requestedTransport: 'auto',
    gatewayId: 'models.dev',
  },
  id: { rootId: 'trace-compatible-root', pulseId: 'p_model_002' },
  links: { parent: 'p_model_001', prev: 'p_model_001' },
}
```

Observation:

- This should be a child of a concrete model call.
- If emitted during model object construction outside a run, it should be skipped.

## Tool Approval and Suspension

Raw sources:

- `tool.approval_policy_resolved`
- `tool.suspend_requested`
- `ask_user.suspended`

Fit:

```ts
{
  timestamp: '2026-06-18T10:00:01.000Z',
  type: 'decision',
  text: 'Tool delete_file requires approval.',
  attributes: {
    event: 'tool.approval.required',
    surface: 'tool',
    tool: { name: 'delete_file', callId: 'call_abc' },
    approval: { policy: 'dynamic', required: true },
  },
  id: { rootId: 'trace-compatible-root', pulseId: 'p_tool_003' },
  links: { parent: 'p_tool_001' },
}
```

Suspension:

```ts
{
  timestamp: '2026-06-18T10:00:01.010Z',
  type: 'state',
  text: 'Tool ask_user suspended waiting for user input.',
  attributes: {
    event: 'tool.suspended',
    surface: 'tool',
    tool: { name: 'ask_user', callId: 'call_ask' },
    suspension: {
      reason: 'user_input',
      resumeSchema: 'present',
    },
  },
  id: { rootId: 'trace-compatible-root', pulseId: 'p_tool_004' },
  links: { parent: 'p_tool_001', prev: 'p_tool_003' },
}
```

Observation:

- Suspension is a state transition, not an output.
- Approval is a decision.
- Resume data should not be duplicated into every later Pulse; attach it to the resume Pulse only.

## Task State Signal Snapshot

Raw source:

- `task_state_signal.snapshot_required`
- `task_state_signal.snapshot_emitted`

Fit:

```ts
{
  timestamp: '2026-06-18T10:00:01.500Z',
  type: 'state',
  text: 'Task state signal emitted a snapshot.',
  data: {
    taskCount: 4,
    completedCount: 1,
    inProgressCount: 1,
    pendingCount: 2,
  },
  attributes: {
    event: 'state_signal.snapshot.emitted',
    surface: 'processor',
    stateSignal: {
      id: 'tasks',
      mode: 'snapshot',
      reason: 'missing_base',
    },
  },
  id: { rootId: 'trace-compatible-root', pulseId: 'p_state_001' },
  links: { parent: 'p_processor_001' },
}
```

Observation:

- Numeric counts fit `data`.
- Full task list likely belongs in attributes only if small, or should be omitted/redacted and left in state storage.
- This should emit from the task state processor, not from thread-state storage.

## Eval Item Retry

Raw source:

- `experiment_item.retry_scheduled`

Fit:

```ts
{
  timestamp: '2026-06-18T10:00:05.000Z',
  type: 'progress',
  level: 'warn',
  text: 'Experiment item will retry after target failure.',
  data: {
    retryAttempt: 1,
    maxRetries: 3,
  },
  attributes: {
    event: 'eval.item.retry_scheduled',
    surface: 'eval',
    experiment: { id: 'exp_123' },
    item: { id: 'item_42' },
    target: { type: 'agent', id: 'research-agent' },
    errorCategory: 'provider_error',
  },
  id: { rootId: 'trace-compatible-root', pulseId: 'p_eval_004' },
  links: { parent: 'p_eval_item_001' },
}
```

Observation:

- Retry attempt and max retries are numeric data.
- Error object details should be on the prior error Pulse, not repeated here.

## A2A Input Required

Raw source:

- `a2a.task_input_required`
- `a2a.stream_suspended`

Fit:

```ts
{
  timestamp: '2026-06-18T10:00:07.000Z',
  type: 'state',
  text: 'Remote A2A task requires input.',
  attributes: {
    event: 'a2a.task.input_required',
    surface: 'a2a',
    remoteAgent: { id: 'a2a-docs-agent' },
    task: {
      id: 'task_remote_123',
      state: 'input-required',
    },
    suspension: {
      waitingForInput: true,
      resumeSchema: 'present',
    },
  },
  id: { rootId: 'trace-compatible-root', pulseId: 'p_a2a_006' },
  links: { parent: 'p_agent_001' },
}
```

Observation:

- A2A is a good fit because the remote task is both user-primitive work and a state machine.
- The remote task could be a nested root with `seedId` if remote execution gets independent Pulse trees.

## Observability Entity Discovery

Raw source:

- `observability_storage.entities_discovered`
- `observability_storage.tags_discovered`

Fit:

No Pulse for initial scope.

Reason:

- This is an API for navigating observability data.
- It is not performed by an agent, workflow, tool, processor, scorer, or model call.
- If the UI later needs self-observability for observability queries, it should be a separate product/ops telemetry concern, not initial Pulse.

## Storage Persistence Failure During Primitive Run

Raw source:

- low-level storage failure from thread-state/memory/workflow storage

Bad fit:

```ts
{
  type: 'error',
  text: 'Filesystem storage write failed.',
  attributes: { event: 'storage.domain_write.failed' }
}
```

Why bad:

- It starts from adapter internals.
- It does not tell which primitive was affected.

Better fit:

```ts
{
  timestamp: '2026-06-18T10:00:01.750Z',
  type: 'error',
  text: 'Task list update could not be persisted.',
  attributes: {
    event: 'task_list.persist.failed',
    surface: 'tool',
    tool: { name: 'task_update' },
    state: { kind: 'threadState', type: 'task' },
    error: {
      name: 'StorageError',
      message: 'write failed',
    },
  },
  id: { rootId: 'trace-compatible-root', pulseId: 'p_task_003' },
  links: { parent: 'p_tool_001' },
}
```

Observation:

- Same failure, but framed around primitive-visible state.
- This supports the `Apply at caller` rule.

