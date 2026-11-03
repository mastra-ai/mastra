---
'@mastra/core': patch
---

Fixed progress from tools wrapped with `createStep` from `@mastra/core/workflows/evented` never reaching the workflow stream. The tool now receives the step `writer`, the run `actor` (including the `actor` step option) and `suspendPayload`, the same as with `createStep` from `@mastra/core/workflows`. Fixes #29164.
