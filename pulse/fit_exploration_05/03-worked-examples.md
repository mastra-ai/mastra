# Worked Examples

This file starts as a scaffold. Fill it during the experiment with concrete relationship-shaped examples.

## 1. Origin Pulse And Derived Flow

Question to test:

- Can a Flow be reconstructed from an origin Pulse plus containment/order relationships without exporting a Flow envelope?

Candidate edges:

```ts
[
  {
    exportType: 'relationship',
    id: 'rel_flow_origin',
    relationship: 'origin_of',
    from: { kind: 'pulse', id: 'pulse_run_started' },
    to: { kind: 'flow', id: 'flow_123' }
  },
  {
    exportType: 'relationship',
    id: 'rel_flow_contains_model',
    relationship: 'flow_contains',
    from: { kind: 'flow', id: 'flow_123' },
    to: { kind: 'pulse', id: 'pulse_model_call_started' }
  }
]
```

Observation to verify:

- This introduces a `flow` endpoint even though Flow is not exported. The experiment must decide whether that is acceptable as an index id or whether the origin Pulse alone should identify the flow.

Decision:

- `flow` endpoint ids are acceptable as derived index identities, but they must not gain Pulse fields or lifecycle semantics.

## 2. Parent Versus External Parent

Question to test:

- Can purpose-named edges avoid the overloaded-parent problem from PR #20499?

Candidate edges:

```ts
[
  {
    exportType: 'relationship',
    id: 'rel_model_parent',
    relationship: 'parent_of',
    from: { kind: 'pulse', id: 'pulse_run_started' },
    to: { kind: 'pulse', id: 'pulse_model_call_started' }
  },
  {
    exportType: 'relationship',
    id: 'rel_external_parent',
    relationship: 'external_parent',
    from: { kind: 'pulse', id: 'pulse_run_started' },
    to: { kind: 'external', system: 'otel', id: 'span_external_abc' }
  }
]
```

Observation to verify:

- These edges are different facts and should not share one `parentId` slot.

## 3. Definition Applicability

Question to test:

- Can the graph answer which tool definitions were active for a model call without copying every definition ref onto the model-call Pulse?

Candidate setup:

```ts
[
  {
    exportType: 'relationship',
    id: 'rel_step1_enables_search',
    relationship: 'enables_definition',
    from: { kind: 'pulse', id: 'pulse_step1_active_tools' },
    to: { kind: 'definition', id: 'tool_searchDocs_v2' },
    scope: { type: 'step', stepId: 'step_1' }
  },
  {
    exportType: 'relationship',
    id: 'rel_call_uses_search',
    relationship: 'uses_tool_definition',
    from: { kind: 'pulse', id: 'pulse_searchDocs_called' },
    to: { kind: 'definition', id: 'tool_searchDocs_v2' }
  }
]
```

Observation to verify:

- Direct `uses_tool_definition` edges are easy to read but may duplicate state implied by prior scoped changes.

Decision:

- Keep direct `uses_tool_definition` for explicit tool calls.
- Use scoped applicability edges for inherited active-tool state.

## 4. Content Reconstruction

Question to test:

- Can full message/context order be rebuilt from content-bearing Pulses and relationship edges?

Candidate edges:

```ts
[
  {
    exportType: 'relationship',
    id: 'rel_user_introduces_content',
    relationship: 'introduced_content',
    from: { kind: 'pulse', id: 'pulse_user_input' },
    to: { kind: 'content', id: 'content_user_message_1' }
  },
  {
    exportType: 'relationship',
    id: 'rel_memory_after_user',
    relationship: 'next_context_item',
    from: { kind: 'content', id: 'content_user_message_1' },
    to: { kind: 'content', id: 'content_memory_pull_1' }
  }
]
```

Observation to verify:

- If content order needs its own relationship vocabulary, the graph model may be broader than Flow reconstruction alone.
