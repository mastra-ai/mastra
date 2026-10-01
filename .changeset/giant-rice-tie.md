---
'@mastra/core': patch
---

Preserved extra fields in tool results passed to model messages, client callbacks, and loop callbacks. Client `onOutput` and `toModelOutput` callbacks now receive results containing only a `value` field as that field's value, while stored tool errors are skipped instead of being processed as successful results.
