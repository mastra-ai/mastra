---
'@mastra/elysia': patch
---

Fixed a spurious "Error in stream processing" log on Elysia when a client disconnects from an agent stream. A disconnect now stops reading the agent stream and closes the response quietly.
