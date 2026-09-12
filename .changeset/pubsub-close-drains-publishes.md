---
'@mastra/redis-streams': patch
'@mastra/valkey-streams': patch
---

`close()` now waits for in-flight publishes to reach the stream before quitting the writer, including publishes that were still connecting. A workflow's terminal event published right as `mastra.shutdown()` closed the pub/sub used to be dropped and reject the publisher with a `ClosingError`.
