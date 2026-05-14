---
'@mastra/core': minor
---

harness v1: add `subagent_*` event surface (§10.2 / §10.6)

`HarnessEvent` now includes five subagent event types — `subagent_start`,
`subagent_text_delta`, `subagent_tool_start`, `subagent_tool_end`,
`subagent_end` — using the spec shape:

```ts
type SubagentEvent =
  | { type: 'subagent_start';      toolCallId; subagentSessionId; agentType; task; modelId;       parentId?; depth }
  | { type: 'subagent_text_delta'; toolCallId; subagentSessionId; agentType; delta;                parentId?; depth }
  | { type: 'subagent_tool_start'; toolCallId; subagentSessionId; agentType; innerToolCallId; toolName; parentId?; depth }
  | { type: 'subagent_tool_end';   toolCallId; subagentSessionId; agentType; innerToolCallId; toolName; output; isError; parentId?; depth }
  | { type: 'subagent_end';        toolCallId; subagentSessionId; agentType; output; isError; durationMs; parentId?; depth };
```

`Session._emitSubagentEvent(event)` is added as the in-process bridge —
it stamps `parentId` (this session's id) and auto-correlates
`queuedItemId` from the parent's currently-running queue item so a
subscriber can route a subagent event back to the `queue()` call that
spawned it.

No spawn-subagent tool changes in this slice — only the event shape and
the bridge primitive that a future `spawn_subagent` tool will call.
