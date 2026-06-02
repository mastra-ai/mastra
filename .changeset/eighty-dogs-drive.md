---
'@mastra/core': minor
---

Added PrefillErrorHandler as a built-in default error processor. Agents now automatically retry when a model rejects assistant-message prefill, without needing to manually configure errorProcessors.
