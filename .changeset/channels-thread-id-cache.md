---
'@mastra/core': patch
---

Improved channels performance by caching the platform-thread-to-Mastra-thread ID mapping in `AgentChannels`. Repeated messages on the same thread skip the metadata-scan storage query after the first lookup.
