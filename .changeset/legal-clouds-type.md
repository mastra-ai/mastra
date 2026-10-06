---
'@mastra/core': patch
---

Fixed `DurableAgent` and `EventedAgent` runs to fail and report the error when mapping a server-executed tool result, including an awaited background result, throws in `toModelOutput`. Client-executed tools and completed deferred background tasks continue with the raw result when their mapper throws.
