---
'@mastra/core': patch
---

Fixed Observational Memory not working with AI SDK v4 models (legacy path). The legacy stream/generate path now calls processInputStep, enabling processors like Observational Memory to inject conversation history and observations.
