---
'@mastra/core': minor
---

Update the experimental AgentController message surface to use the canonical `MastraDBMessage` shape.

The AgentController now emits, persists, and returns DB-native messages where message parts live under `content.parts`, terminal status lives under `content.metadata`, and completed tool invocations retain their explicit error state. Signals such as system reminders and notifications now arrive as separate messages with `role: 'signal'` instead of being flattened into assistant message content.

This affects the experimental AgentController event and session APIs, including `message_start`, `message_update`, `message_end`, `currentMessage`, `listMessages`, `listActiveMessages`, `firstUserMessage`, and `firstUserMessages`.

```ts
agentController.subscribe(event => {
  if (event.type === 'message_end' && event.message.role === 'assistant') {
    // Before: parts were flattened directly onto the message
    // After: read parts and terminal status from the DB-native shape
    const text = event.message.content.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('');
    const stopReason = event.message.content.metadata?.stopReason;
  }
});

// System reminders and notifications are now separate messages
const messages = await agentController.session.thread.listActiveMessages();
const signals = messages.filter(message => message.role === 'signal');
```
