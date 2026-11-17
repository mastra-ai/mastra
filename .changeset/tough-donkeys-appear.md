---
'@mastra/core': patch
---

Fixed messages disappearing from a chat that is reloaded right after sending. AgentController sessions now store a sent, steered, or follow-up message as soon as it is accepted, instead of after the first model response, so a reloaded transcript shows it immediately.

Apps that call `sendMessage`, `sendSignal`, `queueMessage`, or `queueSignal` directly can opt in with `storeOnAccept: true`. With the option on, the message stays stored even if an input processor later rejects it. Read-only memory, a denied memory write permission, and gateway-managed memory store nothing early.

```ts
agent.sendMessage('Hello', { resourceId, threadId, storeOnAccept: true });
```
