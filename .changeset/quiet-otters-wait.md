---
'@mastra/core': patch
---

Durable agent runs now surface a publish failure immediately instead of stalling for ten seconds. When the event transport rejected a publish, the frame stayed in the replay log but never arrived live, so the stream waited out its pending-frame deadline before delivering the error.
