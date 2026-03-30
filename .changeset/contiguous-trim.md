\---

"@mastra/core": minor

\---



add contiguous trimming mode to TokenLimiterProcessor



Adds a new `trimMode` option with a `contiguous` strategy that preserves a continuous suffix of messages by stopping at the first message that exceeds the token budget. Default behavior remains unchanged.

