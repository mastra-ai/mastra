---
'@mastra/memory': patch
---

Fixed observational memory dropping messages when the Observer model returns an empty response. An empty or whitespace-only Observer reply is now retried like a model error, with backoff, up to `observation.maxRetries`. If every attempt comes back empty, `lastObservedAt` stays where it was, so those messages remain pending, and `failurePolicy` decides how the turn proceeds. A provider that always returns empty output therefore uses the full retry budget before `failurePolicy` applies.

`summarizeConversation()` and `memory.summarizeThread()` now throw once retries are exhausted on empty Observer output, instead of returning `summary: ''`.
