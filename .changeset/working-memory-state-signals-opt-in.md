---
'@mastra/core': patch
'@mastra/memory': patch
---

Added experimental `workingMemory.useStateSignals` opt-in. When set to `true`, working memory is delivered to the model as a `state` signal (via the new state-signals API) instead of being folded into the system message. Storage and the `update-working-memory` tool are unchanged — only the delivery path differs. `Memory` auto-attaches a `WorkingMemoryStateProcessor` that emits a snapshot signal with `stateId: 'working-memory'` and dedups via `cacheKey`. The default (`false`) preserves the existing system-message behavior.
