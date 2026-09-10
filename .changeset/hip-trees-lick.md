---
"@mastra/core": patch
---

Fixed durable agent failures disappearing from saved conversation history after reopening. Preserve the original memory policy on resume and keep failed recovery evidence when saving the error fails.
