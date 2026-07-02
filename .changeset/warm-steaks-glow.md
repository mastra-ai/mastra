---
'@mastra/core': patch
---

Fixed durable agents to no longer persist `modelSettings.headers` to durable storage. Headers (which may contain sensitive API keys or auth tokens) are now stripped during serialization and kept in-process on the `RunRegistryEntry`, then merged back at LLM execution time.

Also fixed missing model-config-level headers in the durable header merge pipeline.
