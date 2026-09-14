---
'@mastra/core': patch
---

`stableStringify()` now preserves an own `__proto__` key instead of silently dropping it. The key-sorting accumulator was a plain object literal, so assigning `__proto__` was a no-op and the key never reached the serialized output. Two distinct values — one carrying `__proto__`, one without — therefore produced identical cache keys, which let `MessageMerger` drop distinct `data-*` parts as duplicates and let the agent response cache replay one request's response for another. The accumulator is now seeded with `Object.create(null)`, so every string key round-trips as an ordinary own property.
