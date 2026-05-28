---
'@mastra/core': patch
---

Improved per-message latency in channels by removing two awaited storage round-trips from the chat message dispatch path.
