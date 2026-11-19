---
'@mastra/core': patch
---

Fixed durable agent `stream()`, `resume()`, `recover()` and `observe()` results not exposing the run's trace id and span id. Read them off the result directly, as with a regular agent, instead of reaching through `result.output`.
