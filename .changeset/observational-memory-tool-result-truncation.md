---
'@mastra/memory': patch
---

Limit oversized observational-memory tool results before they reach the observer.

This strips large `encryptedContent` blobs and truncates remaining tool result payloads to keep observer prompts and token estimates aligned with what the model actually sees.
