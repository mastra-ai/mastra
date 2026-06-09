---
'@mastra/server': patch
---

Fixed the Agent Builder selecting models from providers with no API key configured. The builder available-models list now only includes providers whose API key is set, so an agent created in the Agent Builder can no longer be assigned a model that can never run.
