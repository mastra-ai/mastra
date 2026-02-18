---
'@mastra/memory': patch
---

- Reflection retry logic now attempts compression up to level 3, so reflections more consistently shrink to meet token limits
- Default target compression reduced from 50% to 25% (`sliceTokenEstimate * 0.75`), making automatic trimming less aggressive
- `tokensBuffered` marker now reports the actual slice size rather than total observation tokens, giving accurate size monitoring

These changes reduce failed reflections and make reported metrics match what is actually being processed.
