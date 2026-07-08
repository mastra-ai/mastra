# Surface And Action Vocabulary Draft

This is not a final enum. It is a candidate closed-set direction for exploration.

## Surfaces

```ts
type PulseSurface =
  | 'agent'
  | 'agent_config'
  | 'model'
  | 'tool'
  | 'tool_config'
  | 'context'
  | 'thread'
  | 'signal'
  | 'signal_provider'
  | 'memory'
  | 'task'
  | 'workflow'
  | 'processor'
  | 'scorer'
  | 'eval'
  | 'harness'
  | 'harness_pending'
  | 'suspension'
  | 'tool_approval'
  | 'plan'
  | 'content';
```

Concerns:

- `harness` may be too product/framework-specific.
- `message` is intentionally omitted for now. Use `content` or `context`.
- `signal_provider` may be config/relationship only, not Pulse surface.
- `agent_config` and `tool_config` may become `Definition` surfaces if expanded family wins.

## Agent Actions

```ts
type AgentAction =
  | 'run_started'
  | 'run_finished'
  | 'run_failed'
  | 'run_aborted'
  | 'subagent_started'
  | 'subagent_finished';
```

## Agent Config Actions

```ts
type AgentConfigAction =
  | 'created'
  | 'deleted'
  | 'version_created'
  | 'active_version_changed'
  | 'status_changed'
  | 'instructions_changed'
  | 'tool_added'
  | 'tool_removed'
  | 'model_changed'
  | 'request_context_schema_changed';
```

## Model Actions

```ts
type ModelAction =
  | 'input_prepared'
  | 'text_chunk'
  | 'reasoning_chunk'
  | 'usage_recorded'
  | 'finished'
  | 'failed'
  | 'fallback_used';
```

## Tool Actions

```ts
type ToolAction =
  | 'called'
  | 'input_delta'
  | 'returned'
  | 'failed'
  | 'output_streamed';
```

## Context Actions

```ts
type ContextAction =
  | 'message_added'
  | 'message_removed'
  | 'system_instruction_added'
  | 'cleared'
  | 'truncated'
  | 'compacted'
  | 'state_snapshot_applied'
  | 'state_delta_applied';
```

## Signal Actions

```ts
type SignalAction =
  | 'accepted'
  | 'queued'
  | 'dropped'
  | 'drained'
  | 'notification_received'
  | 'state_applied';
```

## Tool Approval Actions

```ts
type ToolApprovalAction =
  | 'required'
  | 'approved'
  | 'declined'
  | 'canceled';
```

## Suspension Actions

```ts
type SuspensionAction =
  | 'created'
  | 'resumed'
  | 'canceled'
  | 'failed';
```

## Relationship Types

```ts
type RelationshipType =
  | 'parent'
  | 'next'
  | 'flow_contains'
  | 'thread_contains_flow'
  | 'previous_flow'
  | 'uses_config_version'
  | 'uses_tool_definition'
  | 'uses_instruction_version'
  | 'resume_of'
  | 'subagent_of'
  | 'supersedes';
```

## Notes

- Actions should be constrained by surface.
- Avoid saving generated display names like `model.text_chunk` as an event name. The UI can derive a name from `surface` and `action`.
- The action sets should remain domain-semantic, not product-page semantic.

