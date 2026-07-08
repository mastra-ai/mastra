# Worked Examples

These examples are intentionally compact. They test shape pressure, not final payload names.

## Example 1: User Message Starts A Flow Without A Message Array

```ts
{
  exportType: 'pulse',
  id: 'exp_pulse_user_01',
  timestamp: '2026-06-23T12:00:00.000Z',
  flowId: 'flow_turn_01',
  pulseId: 'pulse_user_01',
  type: 'input',
  surface: 'signal',
  action: 'accepted',
  text: 'User input accepted for agent flow.',
  attributes: {
    signalType: 'user',
    contentRef: { kind: 'content', id: 'content_user_01' },
    threadId: 'thread_123'
  },
  metadata: {
    resourceId: 'project_abc'
  }
}
```

```ts
{
  exportType: 'relationship',
  id: 'rel_thread_flow_01',
  timestamp: '2026-06-23T12:00:00.000Z',
  relationship: 'thread_contains_flow',
  from: { kind: 'thread', id: 'thread_123' },
  to: { kind: 'flow', id: 'flow_turn_01' }
}
```

Observation:

- This avoids exporting `messages: [...]`.
- `contentRef` needs a backing content store/export that is not yet named in the reduced family.
- If content bodies must be exported in-band, `Change` or `Snapshot` may get abused.

## Example 2: Assistant Text Stream As Buffered Content Pulse

```ts
{
  exportType: 'pulse',
  id: 'exp_pulse_text_01',
  timestamp: '2026-06-23T12:00:01.200Z',
  flowId: 'flow_turn_01',
  pulseId: 'pulse_text_01',
  type: 'output',
  surface: 'model',
  action: 'text_chunk',
  text: 'Assistant text chunk emitted.',
  data: {
    characters: 342,
    chunksBuffered: 8,
    bufferDurationMs: 180
  },
  attributes: {
    contentRef: { kind: 'content', id: 'content_assistant_chunk_01' },
    modelMessageId: 'msg_assistant_01'
  }
}
```

Observation:

- This mirrors the desirable part of current `MODEL_CHUNK` behavior.
- `bufferDurationMs` is acceptable `data`: it is a measurement on this pulse, not the primary span model.
- This is better than emitting a new Pulse for every raw token delta.

## Example 3: Context Truncation As Change Operations

```ts
{
  exportType: 'change',
  id: 'chg_context_01',
  timestamp: '2026-06-23T12:00:02.000Z',
  surface: 'context',
  action: 'truncated',
  subject: { kind: 'context', id: 'ctx_thread_123_active' },
  version: 12,
  previousVersion: 11,
  operations: [
    {
      op: 'truncate',
      path: '/messages',
      removedRefs: [
        { kind: 'message', id: 'msg_001' },
        { kind: 'message', id: 'msg_002' }
      ],
      retainedRefs: [
        { kind: 'message', id: 'msg_010' },
        { kind: 'message', id: 'msg_011' }
      ]
    }
  ],
  data: {
    messagesRemoved: 2,
    messagesRetained: 2,
    tokensRemoved: 1840
  }
}
```

Observation:

- This is the clearest argument against a separate `Delta` export shape.
- The model can understand what changed without seeing the whole prior and next message array.
- The weak point is `retainedRefs`: storing all retained refs could still become large. Use only when needed for reconstruction.

## Example 4: State Signal Snapshot

```ts
{
  exportType: 'change',
  id: 'chg_state_signal_snapshot_01',
  timestamp: '2026-06-23T12:00:03.000Z',
  surface: 'context',
  action: 'state_snapshot_applied',
  subject: { kind: 'state_signal', id: 'tasks' },
  version: 4,
  previousVersion: 3,
  attributes: {
    cacheKey: 'tasks:hash_4',
    mode: 'snapshot',
    valueRef: { kind: 'content', id: 'content_state_tasks_v4' }
  }
}
```

```ts
{
  exportType: 'pulse',
  id: 'exp_pulse_state_signal_01',
  timestamp: '2026-06-23T12:00:03.001Z',
  flowId: 'flow_turn_01',
  pulseId: 'pulse_state_signal_01',
  type: 'state',
  surface: 'signal',
  action: 'state_applied',
  text: 'State signal applied to agent context.',
  attributes: {
    stateId: 'tasks',
    mode: 'snapshot',
    version: 4,
    changeRef: { kind: 'change', id: 'chg_state_signal_snapshot_01' }
  }
}
```

Observation:

- This is a place where emitting both a `Change` and a `Pulse` may be useful.
- The `Change` records durable state versioning.
- The `Pulse` records why the runtime flow saw different context.
- If we only keep the `Change`, flow review may miss the moment it entered the model context.

## Example 5: Tool Definition Once, Runtime Tool Call By Ref

Reduced family:

```ts
{
  exportType: 'change',
  id: 'chg_tool_def_01',
  timestamp: '2026-06-23T11:59:00.000Z',
  surface: 'tool_config',
  action: 'definition_created',
  subject: { kind: 'tool', id: 'searchDocs' },
  version: 'hash_tool_01',
  attributes: {
    descriptionRef: { kind: 'content', id: 'content_tool_desc_01' },
    inputSchemaRef: { kind: 'schema', id: 'schema_tool_input_01' },
    outputSchemaRef: { kind: 'schema', id: 'schema_tool_output_01' }
  }
}
```

```ts
{
  exportType: 'pulse',
  id: 'exp_pulse_tool_call_01',
  timestamp: '2026-06-23T12:00:04.000Z',
  flowId: 'flow_turn_01',
  pulseId: 'pulse_tool_call_01',
  type: 'decision',
  surface: 'tool',
  action: 'called',
  text: 'Tool call selected by model.',
  attributes: {
    toolCallId: 'call_01',
    toolRef: { kind: 'tool', id: 'searchDocs', version: 'hash_tool_01' },
    argsRef: { kind: 'content', id: 'content_tool_args_01' }
  }
}
```

Observation:

- A reduced-family `Change` can represent a definition, but the name becomes awkward.
- The expanded-family `Definition` is semantically clearer here.
- The practical question is whether clarity justifies another export shape.

## Example 6: Harness Tool Suspension And Resume

```ts
{
  exportType: 'pulse',
  id: 'exp_pulse_suspended_01',
  timestamp: '2026-06-23T12:00:05.000Z',
  flowId: 'flow_turn_01',
  pulseId: 'pulse_suspended_01',
  type: 'decision',
  surface: 'suspension',
  action: 'created',
  text: 'Tool call suspended awaiting external input.',
  attributes: {
    toolCallId: 'call_ask_user_01',
    toolName: 'ask_user',
    suspendPayloadRef: { kind: 'content', id: 'content_question_01' },
    resumeSchemaRef: { kind: 'schema', id: 'schema_resume_01' }
  }
}
```

```ts
{
  exportType: 'change',
  id: 'chg_pending_item_01',
  timestamp: '2026-06-23T12:00:05.000Z',
  surface: 'harness_pending',
  action: 'pending_item_created',
  subject: { kind: 'harness_session', id: 'session_01' },
  operations: [
    {
      op: 'add',
      path: '/pending',
      valueRef: { kind: 'pending_item', id: 'pending_01' }
    }
  ],
  attributes: {
    kind: 'tool-suspension',
    status: 'pending'
  }
}
```

```ts
{
  exportType: 'relationship',
  id: 'rel_resume_01',
  timestamp: '2026-06-23T12:00:12.000Z',
  relationship: 'resume_of',
  from: { kind: 'flow', id: 'flow_turn_01_resume' },
  to: { kind: 'pulse', id: 'exp_pulse_suspended_01' }
}
```

Observation:

- Suspension is both an execution observation and a pending-state mutation.
- `resume_of` should be a relationship because the resumed flow is known later.
- This is a strong argument for `Relationship` as a first-class append-only export.

## Example 7: Thread Follow-Up Flow Ordering

```ts
{
  exportType: 'relationship',
  id: 'rel_previous_flow_02',
  timestamp: '2026-06-23T12:05:00.000Z',
  relationship: 'previous_flow',
  from: { kind: 'flow', id: 'flow_turn_02' },
  to: { kind: 'flow', id: 'flow_turn_01' },
  metadata: {
    threadId: 'thread_123'
  }
}
```

Observation:

- This captures order without trusting timestamps alone.
- Direction is debatable. `from=current,to=previous` makes "this flow follows that flow" easy at emission time.
- `nextFlowId` can be derived later.

## Example 8: What Should Not Emit A Pulse

Harness `display_state_changed`:

```ts
{
  type: 'display_state_changed',
  displayState: { /* large current UI state */ }
}
```

Observation:

- This is a read-model update, not an observation of a user primitive.
- It should not become a Pulse.
- If a downstream UI needs this shape, it should be derived from Pulses/Changes/Relationships.

