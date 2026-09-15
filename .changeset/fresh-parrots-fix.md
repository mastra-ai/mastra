---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/code-sdk': patch
'mastracode': patch
'@mastra/core': patch
'mastra': patch
---

**Breaking change**

Agent Controller streams now emit one complete `message_start` payload, followed by ID-addressed `message_update` events for text, reasoning, and message-part changes. `message_end` now contains only the message ID.

**Migration**

Previously, consumers read the complete message from each update. Now, store the start payload by ID and apply subsequent updates to that message:

```ts
if (event.type === 'message_start') messages.set(event.message.id, event.message);
if (event.type === 'message_update') applyUpdate(messages.get(event.id), event.event);
```
