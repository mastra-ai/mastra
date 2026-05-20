---
'@mastra/core': patch
'@internal/storage-test-utils': patch
---

Consolidate in-memory observability tests into the shared vNext storage test suite.

The bespoke `inmemory.test.ts` in `packages/core` previously duplicated coverage that should be defined once and exercised against every vNext observability adapter. Its 34 contract tests now live in `createObservabilityVNextTests` in `@internal/storage-test-utils`, which `_test-utils/src/index.test.ts` runs against the in-memory `MockStore`. Two `extractBranchSpans` helper unit tests moved next to the helper in `tracing.test.ts`.
