---
'@mastra/core': patch
---

Fixed thread subscribers missing approval requests and completion events after a durable agent run recovers from a crash. Recovered runs that pause for tool approval can now be approved and finish normally, including when multiple server instances share Redis.
