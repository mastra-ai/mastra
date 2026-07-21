---
'@mastra/memory': patch
---

Fixed observational memory aborting the agent run when OpenRouter injects a transient provider error into the response stream (e.g. "JSON error injected into SSE stream" with google/gemini-2.5-flash). These mid-stream errors carry the HTTP status on a numeric code property and are now recognized as retryable, so the observer retries with backoff instead of failing the turn.
