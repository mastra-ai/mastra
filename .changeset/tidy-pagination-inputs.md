---
'@mastra/core': patch
---

Reject non-finite, fractional, and negative numeric pagination inputs while preserving defaults, zero-sized pages, and fetch-all pagination. Throw a clear error when directly creating a subagent tool without any subagent definitions.
