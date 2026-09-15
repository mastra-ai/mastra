---
"@mastra/core": patch
---

Fixed durable agents ignoring input processor overrides and resolving the same configuration repeatedly during startup. Automatic memory processors and fresh configuration on subsequent runs are preserved.
