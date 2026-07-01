---
'@mastra/core': major
'@mastra/client-js': patch
'@mastra/server': patch
'mastracode': patch
---

**Removed `AgentControllerMessage` and the deprecated `HarnessMessage` type. The AgentController now produces, streams, persists, and returns the canonical `MastraDBMessage` shape.**

The AgentController used to expose a bespoke, flattened message type whose `content` was a flat array of items like `text`, `tool_call`, and `tool_result`. It now uses `MastraDBMessage` everywhere — the same persisted shape used across the rest of Mastra — where `content` is an object with a `content.parts` array.

This affects the `message_start`, `message_update`, and `message_end` events, the display state's `currentMessage`, and the messages returned by `listMessages`, `listActiveMessages`, `firstUserMessage`, and `firstUserMessages`. Signals such as system reminders and notifications now arrive as separate messages with `role: 'signal'` instead of being flattened into assistant message content.

**Before**

```typescript
agentController.subscribe(event => {
  if (event.type === 'message_update') {
    const text = event.message.content
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('');
  }
});
```

**After**

```typescript
agentController.subscribe(event => {
  if (event.type === 'message_update') {
    const text = event.message.content.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('');
  }
});
```

Import `MastraDBMessage` from `@mastra/core/agent-controller` in place of the removed `AgentControllerMessage`.
