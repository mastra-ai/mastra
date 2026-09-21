---
'@mastra/observability-arize': patch
---

Fixed `tracing.config.test.ts` failing when run together with `tracing.test.ts` by enabling Vitest module isolation; the two files previously shared a module registry under `isolate: false`.
