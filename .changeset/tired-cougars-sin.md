---
'@mastra/code-sdk': minor
---

Added model, mode, and reasoning selection for Agent Client Protocol clients:

```ts
await connection.setSessionConfigOption({
  sessionId,
  configId: 'thought_level',
  value: 'high',
});
```

Fixed assistant output, failed turns, session isolation, working directories, client MCP servers, tool permissions, and cancellation. Token limits and refusals now return their corresponding protocol stop reasons.

Model lists now omit unconfigured providers and retain full routing IDs in labels, preventing gateway entries from appearing to be direct provider models.

Added workspace skill discovery and invocation for Agent Client Protocol clients. Clients can list user-invokable skills and activate them with an ordinary prompt:

```ts
await connection.prompt({
  sessionId,
  prompt: [{ type: 'text', text: '/skill/review Check the current changes' }],
});
```

Skills marked `user-invocable: false` are hidden and cannot be invoked through slash commands.
