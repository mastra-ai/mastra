---
'@mastra/core': patch
---

Fixed OpenAI strict mode schema rejection when using agent networks with structured output. The compat layer was skipped when modelId was undefined, causing optional fields to be missing from the required array. (Fixes #12284)
