---
'@mastra/fastify': patch
---

Fixed request body validation so missing or falsy bodies cannot bypass required route schemas. Bodyless requests remain supported for schemas with optional fields.
