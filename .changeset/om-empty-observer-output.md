---
'@mastra/memory': patch
---

Fixed observational memory dropping messages when the Observer model returns an empty response. An empty or whitespace-only Observer reply is now retried like a model error, up to `observation.maxRetries`. If every attempt comes back empty, `lastObservedAt` stays where it was, so those messages remain pending, and `failurePolicy` decides how the turn proceeds.
