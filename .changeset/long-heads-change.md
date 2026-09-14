---
'@mastra/fastify': patch
---

Fixed request-body validation so missing required bodies and invalid falsy JSON values return validation errors. Bodyless object requests still support optional fields and field defaults. Whole-body defaults apply when the framework passes the omitted body as `undefined`.
