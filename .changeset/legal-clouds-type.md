---
'@mastra/core': patch
---

Fixed `DurableAgent` and `EventedAgent` runs to fail and report the error when a tool's `toModelOutput` mapper throws, instead of continuing with the raw tool result.
