---
'@mastra/core': minor
---

Added tool suspension handling to the Harness.

When a tool calls `suspend()` during execution, the harness now emits a `tool_suspended` event, reports `agent_end` with reason `'suspended'`, and exposes `respondToToolSuspension()` to resume execution with user-provided data.

```ts
harness.subscribe(event => {
  if (event.type === 'tool_suspended') {
    // event.toolName, event.suspendPayload, event.resumeSchema
  }
});

// Resume after collecting user input
await harness.respondToToolSuspension({ resumeData: { confirmed: true } });
```
