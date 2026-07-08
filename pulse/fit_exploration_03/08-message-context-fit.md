# Message Context Fit

The working rule: do not export full `messages` arrays.

## Current Source Shape

`MessageList` currently tracks:

- memory messages
- input messages
- response messages
- context messages
- persisted/unpersisted variants
- system messages
- tagged system messages

It also records mutations:

- `add`
- `addSystem`
- `removeByIds`
- `clear`

Harness currently emits:

- `message_start`
- `message_update`
- `message_end`

The run engine mutates a `HarnessMessage` snapshot as deltas arrive.

## Candidate Pulse/Change Shape

| Current Fact | Candidate Export | Notes |
| --- | --- | --- |
| user message accepted | `Pulse(signal.accepted)` | Content by ref or small inline payload. |
| system instructions active | `Change(context.system_instruction_added)` or `Definition(instructions)` | Prefer definition/ref if stable across flows. |
| memory messages recalled | `Change(context.messages_added)` | Refs to messages; count/tokens in `data`. |
| response text chunk emitted | `Pulse(model.text_chunk)` | Buffered chunks, not every raw token delta unless configured. |
| reasoning chunk emitted | `Pulse(model.reasoning_chunk)` | Redaction/provider metadata in attributes if needed. |
| tool call part added | `Pulse(tool.called)` plus `Change(context.message_part_added)` if reconstructing message | Avoid duplicate args; use refs. |
| message removed | `Change(context.message_removed)` | From `removeByIds`. |
| context cleared | `Change(context.cleared)` | From `clear`. |
| context truncated | `Change(context.truncated)` | Use `truncate` operation. |
| context compacted | `Change(context.compacted)` | Use `compact` operation from refs to summary/reflection. |
| final message assembled | `Snapshot(context/message)` maybe | Only if needed for bounded reconstruction. |

## Proposed Operations

```ts
[
  { op: 'add', path: '/messages/-', valueRef: { kind: 'message', id: 'msg_1' } },
  { op: 'remove', path: '/messages/msg_0', valueRef: { kind: 'message', id: 'msg_0' } },
  {
    op: 'truncate',
    path: '/messages',
    removedRefs: [{ kind: 'message', id: 'msg_0' }],
    retainedRefs: [{ kind: 'message', id: 'msg_1' }]
  },
  {
    op: 'compact',
    fromRefs: [{ kind: 'message', id: 'msg_0' }, { kind: 'message', id: 'msg_1' }],
    toRef: { kind: 'memory_observation', id: 'obs_1' }
  }
]
```

## Fit Result

This works conceptually, but only if content/message refs are real.

Without a content/ref strategy, the model will either:

- sneak full message payloads into `attributes`
- create massive `Snapshot` records
- force every reader to replay an unbounded log

## Recommendation

For the next pass, test a full three-turn thread:

1. initial user message
2. assistant answer with tool call
3. user follow-up
4. context truncation or memory compaction
5. second flow linked to first by `previous_flow`

Pass condition:

- no exported full `messages` array
- runtime review can still reconstruct what the model saw
- duplicate system/tool/instruction content is referenced, not repeated

