---
'@mastra/core': patch
---

Fixed `semanticRecall.filter` being ignored during `agent.generate()` and `agent.stream()`. Agent runs now only recall messages from threads whose metadata matches the filter, the same as `Memory.recall()`. When a filter is set, messages saved during agent runs now store their thread metadata so the filter can match them. Messages that agent runs saved before this fix, or before you added a filter, have no thread metadata and don't match a filter until they're saved or indexed again. Fixes [#29352](https://github.com/mastra-ai/mastra/issues/29352).
