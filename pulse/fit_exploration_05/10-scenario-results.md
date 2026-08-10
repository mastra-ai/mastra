# Scenario Results

This file applies the candidate relationship model to the seed scenarios.

## 1. Normal Agent Run

Minimal graph:

```ts
[
  rel('origin_of', 'pulse_run_started', 'flow_123'),
  rel('flow_contains', 'flow_123', 'pulse_model_step_1'),
  rel('parent_of', 'pulse_run_started', 'pulse_model_step_1'),
  rel('next_pulse', 'pulse_model_step_1', 'pulse_tool_call_1'),
  rel('parent_of', 'pulse_model_step_1', 'pulse_tool_call_1'),
  rel('uses_tool_definition', 'pulse_tool_call_1', 'tool_searchDocs_v2')
]
```

Result:

- Works if Flow ids are allowed as derived index endpoints.
- If Flow ids are not allowed, `pulse_run_started` must be the flow identity and `origin_of` can disappear.

## 2. Thread With Multiple Flows

Minimal graph:

```ts
[
  rel('thread_contains_flow', 'thread_support_1', 'flow_turn_1'),
  rel('thread_contains_flow', 'thread_support_1', 'flow_turn_2'),
  rel('previous_flow', 'flow_turn_2', 'flow_turn_1')
]
```

Result:

- `next_flow` is derivable.
- Thread order should not depend on timestamps alone.

## 3. Suspended And Resumed Execution

Minimal graph:

```ts
[
  rel('flow_contains', 'flow_123', 'pulse_tool_suspended'),
  rel('flow_contains', 'flow_123', 'pulse_run_resumed'),
  rel('resume_of', 'pulse_run_resumed', 'pulse_tool_suspended')
]
```

Result:

- `resume_of` is clearer than making the resumed run an ordinary child of the suspended Pulse.
- If resume enters a different trace/flow because caller-provided tracing overrides the persisted trace, add `external_parent` or `related_flow` rather than changing `resume_of`.

## 4. External Parent Bridge

Minimal graph:

```ts
[
  rel('external_parent', 'pulse_run_started', {
    kind: 'external',
    system: 'otel',
    id: 'span_external_abc'
  })
]
```

Result:

- This preserves the PR #20499 lesson.
- External parentage is correlation/bridge data, not Mastra execution parentage.

## 5. Scoped Definition Change

Minimal graph:

```ts
[
  rel('uses_config_version', 'pulse_run_started', 'agent_config_support_v4'),
  rel('enables_definition', 'pulse_step1_active_tools', 'tool_searchDocs_v2', {
    scope: { type: 'step', stepId: 'step_1' }
  }),
  rel('uses_tool_definition', 'pulse_searchDocs_called', 'tool_searchDocs_v2')
]
```

Result:

- The direct `uses_tool_definition` edge on the tool call is worthwhile because it is an explicit runtime fact.
- Do not repeat all inherited config/tool/settings refs on every descendant Pulse unless a read index materializes them.

## 6. Context Compaction Without Snapshot

Minimal graph:

```ts
[
  rel('introduced_content', 'pulse_user_input', 'content_user_1'),
  rel('introduced_content', 'pulse_memory_pull', 'content_memory_1'),
  rel('next_context_item', 'content_user_1', 'content_memory_1'),
  rel('replaced_content', 'pulse_context_compacted', 'content_user_1'),
  rel('replaced_content', 'pulse_context_compacted', 'content_memory_1'),
  rel('introduced_content', 'pulse_context_compacted', 'content_summary_1'),
  rel('compacted_to', 'content_user_1', 'content_summary_1'),
  rel('compacted_to', 'content_memory_1', 'content_summary_1')
]
```

Result:

- Snapshot is not needed for the conceptual model.
- A materialized context index may still be needed for fast reads over long threads.

