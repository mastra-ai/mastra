---
'@mastra/core': patch
---

Ignore malformed numeric `Retry-After` values instead of parsing them as years and delaying retries up to the configured cap.
