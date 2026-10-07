---
'@mastra/core': patch
---

Preserved extra fields in tool results passed to model messages, client callbacks, and loop callbacks. Client `onOutput` and `toModelOutput` callbacks now receive results containing only a `value` field as that field's value. AI SDK error outputs are stored as failed invocations, skipped by client callbacks, and exposed to response consumers as their underlying error value.
