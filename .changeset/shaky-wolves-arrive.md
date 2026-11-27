---
'@mastra/core': patch
---

Fixed `stream({ untilIdle: true })` and `resumeStream({ untilIdle: true })` reading the agent's dynamic `defaultOptions` one extra time on each call. The deprecated `streamUntilIdle()` and `resumeStreamUntilIdle()` now call `stream()` and `resumeStream()` with `untilIdle`, so they behave the same as the options that replace them.
