---
'@mastra/core': patch
---

Fixed evented agents calling a throwing `stopWhen` three times. A `stopWhen` error now fails the run on the first attempt, the same as on the other engines, so side effects in the predicate run once and the stream rejects with the error straight away.
