---
'@mastra/inngest': patch
---

Fixed approving a tool call right after the approval prompt on an Inngest agent. `approveToolCall()` sometimes returned an empty stream and the approved tool never ran, because the resumed stream closed on the earlier part's suspend event. Approving immediately now resumes the run and streams the result.
