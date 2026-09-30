---
'@mastra/connect': patch
---

Provider errors that nest their message as `{ "error": { "message": "..." } }` (for example OpenAI) now include that message in the thrown error. A missing OpenAI batch now reports `Provider request failed (404): No such batch: batch_abc123` instead of `Provider request failed (404).`
