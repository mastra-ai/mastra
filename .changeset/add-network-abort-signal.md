---
'@mastra/core': minor
---

Add support for aborting agent network execution via `abortSignal`. When you abort the network, the signal propagates to all sub-agents, workflows, and tool executions.

```typescript
const abortController = new AbortController();

const result = await agent.network('Research dolphins and summarize', {
  memory: { thread: 'user-123', resource: 'app' },
  maxSteps: 10,
  abortSignal: abortController.signal,
  onAbort: () => console.log('Network aborted'),
});

// Later, to stop everything:
abortController.abort();
```

The abort signal is forwarded to:
- Sub-agent `stream()` calls
- Nested workflow executions (cancels the run)
- Tool `execute()` context
- Routing agent decisions

A `network-execution-event-abort` event is emitted when cancellation occurs.

Fixes #10874

