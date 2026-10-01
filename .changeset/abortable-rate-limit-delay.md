---
'@mastra/core': patch
---

Fixed aborting an agent run taking up to 10 seconds when the provider reported low remaining rate-limit tokens. The pause between steps now ends as soon as the run's `abortSignal` fires.
