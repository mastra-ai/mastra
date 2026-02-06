---
'@mastra/core': patch
---

Fixed Moonshot AI (moonshotai and moonshotai-cn) models using the wrong base URL. The Anthropic-compatible endpoint was not being applied, causing API calls to fail with an upstream LLM error.
