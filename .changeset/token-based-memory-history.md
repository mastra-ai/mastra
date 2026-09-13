---
'@mastra/core': minor
'@mastra/memory': minor
'@mastra/server': minor
'@mastra/client-js': patch
---

Add a `messageHistory` memory option for token-budgeted conversation history. `messageHistory: { maxTokens, atMaxRemoveTokens? }` keeps recent history within a token budget, dropping the oldest remembered messages in chunks while never removing the current turn's input, responses, context, or system messages. A forward-only boundary is persisted per thread so trimmed history stays out of subsequent turns without deleting stored messages.

When `messageHistory` is set without an explicit `lastMessages`, the default 10-message cap is dropped so the token budget alone defines the window. `lastMessages` remains supported and can be combined with `messageHistory`, but counting messages is a poor proxy for context size and `lastMessages` is now soft-deprecated in favour of `messageHistory`.

```ts
import { Memory } from '@mastra/memory';

const memory = new Memory({
  options: {
    messageHistory: { maxTokens: 8_000, atMaxRemoveTokens: 2_000 },
  },
});
```
