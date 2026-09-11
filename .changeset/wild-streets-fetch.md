---
'@mastra/core': patch
---

Fixed `lastMessages` counting stored signal rows, which evicted the previous turn's tool results from the agent context window when `useStateSignals` was enabled. The window now holds the configured number of conversation messages (#23231).
