---
'@mastra/code-sdk': patch
'mastracode': patch
'@mastra/core': patch
---

Added `applyUpdate(message, update)` so a consumer can fold the ID-addressed `message_update` events a streamed assistant message now emits.

Streamed message events were made compact in a prior release: `message_start` carries the message, `message_update` carries one delta addressed by message ID, and `message_end` carries only the ID. The migration guidance for that change called `applyUpdate`, which no package exported, so consumers following it recovered no text. The function is now exported from `@mastra/core/agent-controller` and re-exported by the `mastracode` and `@mastra/code-sdk` entry points. It is the same fold the Agent Controller uses internally to build display state, so a consumer and the framework apply the same deltas in the same way.

```ts
import { applyUpdate } from '@mastra/core/agent-controller';

if (event.type === 'message_start') messages.set(event.message.id, event.message);
if (event.type === 'message_update') {
  const updated = applyUpdate(messages.get(event.id), event.event);
  if (updated) messages.set(event.id, updated);
}
```

Store the result only when it applies. A delta that does not apply, such as a reasoning delta whose part the consumer has not seen, returns `undefined`. You do not need the helper when you hold a `Session`: read `session.displayState.get().currentMessage`.
