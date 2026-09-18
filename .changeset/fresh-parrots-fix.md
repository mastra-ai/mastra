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
import { applyUpdate } from '@mastra/core/agent-controller';

if (event.type === 'message_start') messages.set(event.message.id, event.message);
if (event.type === 'message_update') {
  const updated = applyUpdate(messages.get(event.id), event.event);
  if (updated) messages.set(event.id, updated);
}
```

`applyUpdate` returns `undefined` when an update doesn't apply, so store its result only when it does. When a `Session` is available you don't need to fold anything: read `session.displayState.get().currentMessage`, which core keeps in sync with the same updates.
