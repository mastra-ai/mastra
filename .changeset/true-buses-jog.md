---
'@mastra/server-adapters-test-suite': patch
'@mastra/core': patch
---

Fixed resuming a suspended durable or evented agent with `resumeStreamUntilIdle()` (or `resumeStream(..., { untilIdle: true })`). The resume no longer stops the parked run it is taking over, so the resumed tool result is delivered instead of failing with "already finished".
