---
'@mastra/core': patch
---

Limit controller thread listings by reading an expanding newest-first storage prefix, doubling its size when forked or out-of-scope threads must be skipped. Session creation and recovery use the same scoped lookup for the initial thread, but other session operations can still read the full resource. Adapters that scan and sort all threads before pagination are read once instead; unsupported metadata filters and many exclusions can require reading the full resource. Fractional limits retain truncating behavior.
