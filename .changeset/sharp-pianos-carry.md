---
'@mastra/core': patch
---

Fixed agent loops so truncated model responses stop instead of retrying pending tool calls until max steps.
