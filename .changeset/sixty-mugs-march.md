---
'@mastra/server': minor
---

Added A2A v0.3 human-in-the-loop task handling. Exposed agents now pause with an input-required status and resume the same run when clients send follow-up input.

```typescript
await fetch('https://agent.example.com/api/a2a/booking-agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 'resume-1',
    method: 'message/send',
    params: {
      message: {
        kind: 'message',
        messageId: crypto.randomUUID(),
        role: 'user',
        taskId,
        parts: [{ kind: 'text', text: 'Approved' }],
      },
    },
  }),
});
```

The server also preserves terminal task states and handles authentication interruptions, resubscription, cancellation errors, unknown task IDs, and JSON-RPC request ID zero.
