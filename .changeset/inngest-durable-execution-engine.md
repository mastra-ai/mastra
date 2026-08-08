---
'@mastra/inngest': minor
---

Durable Inngest agents now preserve event delivery and replay history across resumes and honor configured `maxSteps` limits.

They also accept `maxSteps: false` for completion-or-abort governed runs without a numeric step ceiling.
