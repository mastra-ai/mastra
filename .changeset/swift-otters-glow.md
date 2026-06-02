---
'mastra': patch
---

Agent Builder: clearer status during stream retries, friendly error UI, and a one-click retry

- The "Reasoning…" indicator now stays visible while the builder is between streaming chunks (e.g. during a `StreamErrorRetryProcessor` retry), so the chat no longer looks frozen between steps.
- Stream errors render as a banner with a parsed, human-readable message instead of dumping the raw JSON payload into the assistant message. The full payload is available behind a "Details" toggle for debugging.
- The error banner includes a "Try again" button that resubmits the last user prompt against the same thread, so transient failures no longer require typing the prompt again.
