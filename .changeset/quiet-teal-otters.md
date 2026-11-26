---
'@mastra/core': patch
---

Memory now throws a clear error when observational memory is enabled on a storage adapter that doesn't support it (for example Cloudflare D1). Previously the agent ran without saving or recalling any messages and logged nothing. To fix the error, switch to a storage adapter that supports observational memory or set `observationalMemory: false`.
