---
'@mastra/memory': patch
---

Fixed `lastMessages` counting stored signal rows in `recall()` and `getContext()`, so the history window now holds the configured number of conversation messages instead of losing the previous turn's tool results (#23231).
