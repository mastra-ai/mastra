---
'@mastra/core': patch
---

Fixed a reply coming back duplicated after an interrupted turn. When an error-retry processor or the durable loop moved the response message id without sealing the stored response, the streamed message split where the stored one did not, so the second half reappeared under its own id on reload. Rotating a response message id now seals the response it leaves behind.
