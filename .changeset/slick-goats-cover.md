---
'@mastra/core': patch
---

Fixed fallback model attribution in agent traces. When an agent fell back after the primary model failed, token usage and cost were reported against the primary model instead of the fallback that actually served the response (e.g. in Langfuse). Fixes #13547.
