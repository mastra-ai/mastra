---
'@mastra/observability': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

Real-time span export for Inngest workflow engine

- Spans are now exported immediately when created and ended, instead of being batched at workflow completion
- Added durable span lifecycle hooks (`createStepSpan`, `endStepSpan`, `errorStepSpan`, `createChildSpan`, `endChildSpan`, `errorChildSpan`) that wrap span operations in Inngest's `step.run()` for memoization
- Added `rebuildSpan()` method to reconstruct span objects from exported data after Inngest replay
- Fixed nested workflow step spans missing output data
- Spans correctly maintain parent-child relationships across Inngest's durable execution boundaries using `tracingIds`
