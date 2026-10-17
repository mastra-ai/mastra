---
'@mastra/memory': patch
---

Fixed observational memory dropping messages when the Observer model returns an empty response. An empty or whitespace-only Observer output is now treated as an observation failure. `lastObservedAt` no longer advances past those messages, so they stay pending, and `failurePolicy` decides how the turn proceeds, the same as for a model error.
