---
'@mastra/inngest': patch
---

Typed `runId` on the `onStepFinish` payload for `createInngestAgent` stream, resume and observe calls. You can now read `payload.runId` without a cast. Fixes #26524.
