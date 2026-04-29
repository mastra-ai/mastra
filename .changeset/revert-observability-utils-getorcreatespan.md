---
'@mastra/core': patch
---

Reverted the ambient-span fallback in `getOrCreateSpan` (and its regression tests) introduced by #15792. When no explicit `tracingContext.currentSpan` was supplied, `getOrCreateSpan` was walking to the ambient span installed by `executeWithContext()` and parenting new spans under it, which caused unintended span nesting in callers that relied on starting a new root span. The original behavior is restored: `getOrCreateSpan` creates a child span only when `tracingContext.currentSpan` is set, and otherwise starts a new root span.
