---
'@mastra/client-js': patch
---

Added typed display-state fields to the agent-controller `display_state_changed` event: `activeTools`, `toolInputBuffers`, `pendingSuspensions`, `activeSubagents`, and `modifiedFiles` are now declared on the event payload.

```ts
const session = client.getAgentController('code').session('user-1');
await session.subscribe({
  onEvent: event => {
    if (event.type === 'display_state_changed') {
      for (const [toolCallId, tool] of Object.entries(event.displayState.activeTools ?? {})) {
        console.log(`${tool.name} is ${tool.status} (${toolCallId})`);
      }
    }
  },
});
```
