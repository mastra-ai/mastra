---
'@mastra/inngest': patch
---

Fixed `streamUntilIdle()` and `resumeStreamUntilIdle()` on `createInngestAgent()` agents running in the Mastra server process instead of on Inngest. The `/stream-until-idle` and `/resume-stream-until-idle` routes now run durably, the same as `stream(messages, { untilIdle: true })`. Fixes #25159.
