---
'@mastra/core': patch
---

Fixed `semanticRecall.filter` being ignored during `agent.generate()` and `agent.stream()`. Agent runs now only recall messages from threads whose metadata matches the filter, the same as `Memory.recall()`. Messages that agent runs saved before their embeddings stored thread metadata don't match a filter until they're saved or indexed again. Fixes [#29352](https://github.com/mastra-ai/mastra/issues/29352).
