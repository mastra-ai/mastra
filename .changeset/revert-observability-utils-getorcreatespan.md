---
'@mastra/core': patch
---

Fixed `getOrCreateSpan` to restore previous span-parenting behavior.
Calls without `tracingContext.currentSpan` now start a new root span instead of attaching to ambient context, preventing unintended nesting.
