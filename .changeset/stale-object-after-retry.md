---
'@mastra/core': patch
---

Fixed `result.object` staying stale after a successful output-processor retry. When an `OutputProcessor` rejected a structured-output attempt with `abort(reason, { retry: true })`, the retried model call emitted a fresh `object-result` chunk, but `object` had already been resolved from the rejected first attempt and kept that value. `result.text` advanced to the retried response while `result.object` silently did not, with no warning to signal the divergence — so consumers reading `result.object` received the answer the processor had just rejected.

`object-result` chunks are now buffered and the promise is resolved once on `finish`, from the last chunk received. Resolving per chunk could not be fixed by simply preferring the latest value: any consumer that reads `result.object` before the stream drains materializes the underlying promise, and a settled promise ignores every later `resolve`. A validation rejection is still never overwritten. Fixes https://github.com/mastra-ai/mastra/issues/20570
