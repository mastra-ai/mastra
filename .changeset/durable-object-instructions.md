---
"@mastra/core": patch
---

Fixed durable agents that could drop object-form system instructions when provider options like `cacheControl` were used. These instructions are now preserved so provider-specific options are respected.
