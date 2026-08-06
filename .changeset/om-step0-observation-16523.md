---
'@mastra/memory': patch
---

Trigger observational-memory observation at step 0 when the threshold is exceeded. Previously a single over-threshold message arriving at step 0 hit neither the observation path (gated on step > 0) nor the async buffering path (which requires pending tokens below the threshold), so the observer was never called — even with the default configuration. Step 0 now observes when the threshold is exceeded and no tool calls are pending, seeds the active assistant response message so observation markers persist correctly, and retains the freshly observed message in context via the retention floor. Fixes #16523.
