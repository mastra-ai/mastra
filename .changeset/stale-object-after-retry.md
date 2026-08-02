---
'@mastra/core': patch
---

Fixed `result.object` staying stale after a successful output-processor retry. When an `OutputProcessor` rejected a structured-output attempt with `abort(reason, { retry: true })`, `result.text` advanced to the retried response but `result.object` kept the rejected first attempt. `result.object` now resolves to the retried response. Fixes https://github.com/mastra-ai/mastra/issues/20570
