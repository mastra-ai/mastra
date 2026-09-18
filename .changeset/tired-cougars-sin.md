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

Fixed user prompts and internal system messages appearing as assistant replies. Failed turns now return errors that clients can display; token limits and refusals return their corresponding protocol stop reasons.

Each conversation now has its own runtime and uses the client's requested working directory. Client-supplied stdio and HTTP MCP servers connect with their configured environment variables or headers. Unsupported legacy SSE servers return an error before session startup.

Tool approvals and sandbox access requests now ask the client for permission. Cancelling a session stops its active turn and queued prompts without interrupting other conversations. Shutdown waits for cleanup even when multiple signals arrive.

Model lists now omit unconfigured providers and retain full routing IDs in labels, preventing gateway entries from appearing to be direct provider models.

Added workspace skill discovery and invocation for Agent Client Protocol clients. Clients can list user-invokable skills and activate them with an ordinary prompt:

```ts
await connection.prompt({
  sessionId,
  prompt: [{ type: 'text', text: '/skill/review Check the current changes' }],
});
```

Skills marked `user-invocable: false` are hidden and cannot be invoked through slash commands.
