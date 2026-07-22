---
'@mastra/core': patch
---

Fixed agent model-call retries ignoring the provider's `Retry-After` response header.

An agent that retries a failed model call (via `maxRetries`) backed off on a fixed exponential schedule. A provider replying `429` with `Retry-After: 30` was retried after 1s, 2s and 4s, so every attempt landed inside the window the provider was still throttling. Retries now wait for the delay the provider asks for, reading either `Retry-After` or `Retry-After-Ms`.

Waits are limited to 30 seconds, so an unusually large `Retry-After` cannot stall a run. When a provider sends no retry delay, the existing exponential backoff is unchanged.

Fixes #19885
