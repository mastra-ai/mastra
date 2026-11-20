---
'@mastra/core': patch
---

Fixed background tasks exceeding maxRetries after worker crashes. Recovery now consumes the retry budget and marks tasks as failed once it is exhausted.
