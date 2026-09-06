---
'@mastra/core': patch
---

Fixed the built-in web reader to stop on cancellation and finish within one 15-second deadline across redirects and response bodies.

Fetch failures and timeouts still return `isError: true`. Explicit cancellation through the native tool context now rejects with the abort signal's reason, allowing the agent or workflow to stop.
