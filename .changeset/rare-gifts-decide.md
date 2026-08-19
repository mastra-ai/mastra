---
'@mastra/core': patch
---

Fixed a reply coming back duplicated after an interrupted turn. When an error-retry processor or the durable loop moved the response message id without sealing the stored response, the streamed message split where the stored one did not, so the second half reappeared under its own id on reload. Rotating a response message id now seals the response it leaves behind, so the two can no longer drift apart.

Durable runs gained the same error-retry hooks the regular agent already had: a `processAPIError` processor now receives `messageId` and `rotateResponseMessageId`, works on the run's live message list instead of a throwaway copy, and a rotation survives the retry that follows it. Message ids minted during a durable run also honour a custom `generateId` configured on `Mastra`, which some paths silently ignored.
