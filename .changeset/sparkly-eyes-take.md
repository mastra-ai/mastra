---
'@mastra/core': patch
---

Fixed failed model calls showing as successful in traces. When a model call fails and no retry or fallback is left, the inference, step and model spans now record the error too, not only the agent root span.
