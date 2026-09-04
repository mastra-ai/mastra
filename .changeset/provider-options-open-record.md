---
'@mastra/server': patch
---

Stop stripping non-allowlisted `providerOptions` namespaces (deepseek, bedrock, groq, ...) during agent execution request validation. The schema listed only four providers and zod removes unknown keys from nested objects, so every other provider's options were silently dropped at the route boundary. Fixes #22617.
