---
'@mastra/code-sdk': patch
---

Fixed a rate-limited request waiting out the provider's retry delay on the same subscription when another subscription of that provider was still available. It now switches to the other subscription straight away. A request with a single subscription, or pinned to one, still waits and retries once.
