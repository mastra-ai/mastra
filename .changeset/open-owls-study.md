---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed Observational Memory model resolution for user-defined gateways. Models such as `cloudflare/google/gemini-2.5-flash-lite` now resolve through registered gateways instead of failing with provider-config errors. Closes #13841.
