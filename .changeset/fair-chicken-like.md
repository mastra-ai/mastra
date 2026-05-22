---
'@mastra/core': patch
---

Fixed processor-returned system messages clearing the tags on other system messages, such as observational memory. Returned `systemMessages` now replace untagged system messages while preserving tagged system messages owned by other processors, preventing memory context from going stale or duplicating across agent steps.
