---
"@mastra/core": patch
---

Improve error messages when processor workflows or model fallback retries fail.

- Include the last error message and cause when all fallback models are exhausted, instead of the generic "Exhausted all fallback models" message.
- Extract error details from failed workflow results and individual step failures when a processor workflow fails, instead of just reporting "failed with status: failed".
