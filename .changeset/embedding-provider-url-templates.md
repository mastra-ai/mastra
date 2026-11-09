---
'@mastra/core': patch
---

Fixed embedding models for providers whose base URL comes from an environment variable, such as Neon. These models previously failed with `Invalid URL` because the provider URL template was not resolved.
