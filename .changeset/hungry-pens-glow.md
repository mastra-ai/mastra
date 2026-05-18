---
'@mastra/client-js': patch
---

Fixed an issue where recursive client-tool continuations after `resumeStream` (and `resumeStreamUntilIdle`) incorrectly re-hit the one-shot resume endpoint instead of falling back to the regular stream endpoint. The resume routes consume server-side `resumeData` and cannot be replayed, so client-tool continuations now route to `/stream` and `/stream-until-idle` respectively.
