---
'@mastra/core': patch
---

Fixed durable agents failing to resume delegated sub-agent or workflow tools that suspend mid-execution without an approval. The suspended inner run is now persisted with the tool call, so resumeStream() continues that run instead of restarting the delegate — including after a server restart. See #20496
