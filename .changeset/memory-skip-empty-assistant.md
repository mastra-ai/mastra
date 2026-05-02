---
'@mastra/core': minor
'@mastra/memory': minor
---

Add an opt-in `skipEmptyAssistantMessages` memory option.

When enabled, memory persistence skips assistant messages that have no
meaningful output after normal working-memory cleanup. This prevents no-op
assistant rows from aborted or failed turns from being replayed into future
model context, while preserving messages that carry real text in
`content.content` even when their `parts` array is empty.

Usage:

```ts
import { Memory } from '@mastra/memory';

const memory = new Memory({
  options: {
    skipEmptyAssistantMessages: true,
  },
});
```
