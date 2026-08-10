# End-To-End Graph

This scenario combines the hard cases into one graph:

- thread with a previous flow
- new agent run using config v4
- scoped active-tool change
- model/tool sequence
- provider/client/external bridge pressure
- content introduction
- suspension and resume
- context compaction

## Entities

```ts
const thread = { kind: 'thread', id: 'thread_support_1' };
const flow1 = { kind: 'flow', id: 'flow_turn_1' };
const flow2 = { kind: 'flow', id: 'flow_turn_2' };

const configV4 = { kind: 'definition', id: 'agent_config_support_v4' };
const searchTool = { kind: 'definition', id: 'tool_searchDocs_v2' };
const createIssueTool = { kind: 'definition', id: 'tool_createIssue_v1' };

const externalParent = { kind: 'external', system: 'otel', id: 'span_external_abc' };
```

## Pulses

```ts
[
  pulse('pulse_user_input', 'input', 'content', 'received'),
  pulse('pulse_run_started', 'input', 'agent', 'run_started'),
  pulse('pulse_step1_tools', 'state', 'tool_config', 'active_tools_changed'),
  pulse('pulse_model_step1', 'decision', 'model', 'called'),
  pulse('pulse_search_called', 'input', 'tool', 'called'),
  pulse('pulse_search_result', 'output', 'tool', 'returned'),
  pulse('pulse_create_issue_suspended', 'state', 'suspension', 'created'),
  pulse('pulse_resume_received', 'input', 'suspension', 'resume_received'),
  pulse('pulse_run_resumed', 'input', 'agent', 'run_resumed'),
  pulse('pulse_create_issue_result', 'output', 'tool', 'returned'),
  pulse('pulse_assistant_output', 'output', 'model', 'message_completed'),
  pulse('pulse_context_compacted', 'state', 'context', 'compacted')
]
```

## Relationships

```ts
[
  // Flow and thread identity
  rel('thread_contains_flow', thread, flow1),
  rel('thread_contains_flow', thread, flow2),
  rel('previous_flow', flow2, flow1),
  rel('origin_of', 'pulse_user_input', flow2),

  // Flow membership
  rel('flow_contains', flow2, 'pulse_user_input'),
  rel('flow_contains', flow2, 'pulse_run_started'),
  rel('flow_contains', flow2, 'pulse_step1_tools'),
  rel('flow_contains', flow2, 'pulse_model_step1'),
  rel('flow_contains', flow2, 'pulse_search_called'),
  rel('flow_contains', flow2, 'pulse_search_result'),
  rel('flow_contains', flow2, 'pulse_create_issue_suspended'),
  rel('flow_contains', flow2, 'pulse_resume_received'),
  rel('flow_contains', flow2, 'pulse_run_resumed'),
  rel('flow_contains', flow2, 'pulse_create_issue_result'),
  rel('flow_contains', flow2, 'pulse_assistant_output'),
  rel('flow_contains', flow2, 'pulse_context_compacted'),

  // Execution parentage
  rel('parent_of', 'pulse_run_started', 'pulse_model_step1'),
  rel('parent_of', 'pulse_model_step1', 'pulse_search_called'),
  rel('parent_of', 'pulse_model_step1', 'pulse_create_issue_suspended'),
  rel('parent_of', 'pulse_run_resumed', 'pulse_create_issue_result'),
  rel('parent_of', 'pulse_run_resumed', 'pulse_assistant_output'),

  // External bridge and resume lineage
  rel('external_parent', 'pulse_run_started', externalParent),
  rel('resume_of', 'pulse_run_resumed', 'pulse_create_issue_suspended'),

  // Definition use and scoped applicability
  rel('uses_config_version', 'pulse_run_started', configV4),
  rel('enables_definition', 'pulse_step1_tools', searchTool, { scope: { type: 'step', stepId: 'step_1' } }),
  rel('uses_tool_definition', 'pulse_search_called', searchTool),
  rel('uses_tool_definition', 'pulse_create_issue_suspended', createIssueTool),
  rel('uses_tool_definition', 'pulse_create_issue_result', createIssueTool),

  // Runtime sequence where order matters
  rel('next_pulse', 'pulse_user_input', 'pulse_run_started'),
  rel('next_pulse', 'pulse_run_started', 'pulse_step1_tools'),
  rel('next_pulse', 'pulse_step1_tools', 'pulse_model_step1'),
  rel('next_pulse', 'pulse_model_step1', 'pulse_search_called'),
  rel('next_pulse', 'pulse_search_called', 'pulse_search_result'),
  rel('next_pulse', 'pulse_search_result', 'pulse_create_issue_suspended'),
  rel('next_pulse', 'pulse_create_issue_suspended', 'pulse_resume_received'),
  rel('next_pulse', 'pulse_resume_received', 'pulse_run_resumed'),

  // Content ownership and context state
  rel('introduced_content', 'pulse_user_input', 'content_user_2'),
  rel('introduced_content', 'pulse_search_result', 'content_search_result_1'),
  rel('introduced_content', 'pulse_assistant_output', 'content_assistant_2'),
  rel('next_context_item', 'content_user_2', 'content_search_result_1'),
  rel('next_context_item', 'content_search_result_1', 'content_assistant_2'),
  rel('replaced_content', 'pulse_context_compacted', 'content_user_2'),
  rel('replaced_content', 'pulse_context_compacted', 'content_search_result_1'),
  rel('introduced_content', 'pulse_context_compacted', 'content_summary_2'),
  rel('compacted_to', 'content_user_2', 'content_summary_2'),
  rel('compacted_to', 'content_search_result_1', 'content_summary_2')
]
```

## Reconstruction Checks

### Show The Flow

Use:

- `origin_of`
- `flow_contains`
- `parent_of`
- `next_pulse`
- `resume_of`

Result:

- The reader can show one coherent flow with a suspended segment and resumed segment.
- Resume is visible without pretending the resumed run is an ordinary child of the suspended Pulse.

### Show Thread Order

Use:

- `thread_contains_flow`
- `previous_flow`

Result:

- Flow 2 follows Flow 1 without relying on timestamps.
- `next_flow` remains derivable.

### Show Active Definitions

Use:

- `uses_config_version` on run start
- `enables_definition` on scoped tool change
- direct `uses_tool_definition` on tool calls
- read index materializes inherited config/tool state for each Pulse

Result:

- Runtime Pulse payloads do not copy config/tool bodies.
- Direct tool-call relationships keep explicit use easy to query.

### Show Context

Use:

- `introduced_content`
- `next_context_item`
- `replaced_content`
- `compacted_to`

Result:

- The model-visible context can be reconstructed without a full message array export.
- Long threads still need a materialized context index for performance.

## Verdict

This graph is verbose but coherent.

The main simplification pressure is on `next_pulse`: not every Pulse pair should need a sequence edge. Use explicit ordering only when order is semantically meaningful or timestamp ordering is insufficient.

