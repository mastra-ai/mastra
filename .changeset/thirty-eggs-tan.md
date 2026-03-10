---
'@mastra/core': patch
---

Fixed model fallback retry behavior. Non-retryable errors (401, 403) are no longer retried on the same model before falling back. Retryable errors (429, 500) are now only retried by a single layer (p-retry) instead of being duplicated across two layers, preventing (maxRetries + 1)² total calls. The per-model maxRetries setting now correctly controls how many times p-retry retries on that specific model before the fallback loop moves to the next model.
