---
'@mastra/core': minor
---

Added `agent.getMessages()` to tool execution context in standard and durable agent loops. Tools can read the current conversation, including remembered messages and in-run responses, without changing the existing input-only `messages` field.

```ts
execute: async (input, context) => {
  const messages = context?.agent?.getMessages?.() ?? [];
  return { messageCount: messages.length };
}
```

The getter reflects message-list removals, but not transient transforms applied only to the provider prompt. Treat returned messages as read-only.
