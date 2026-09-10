---
"@mastra/core": patch
---

Fixed agent runs reporting success after required checks or message saves fail. Final guard refusals now close the run, preserve their details, and allow the next message. Final text respects output processors, including complete removal. Failed saves retain pending messages for an explicit later save.

Final processors now keep primary text, saved messages and scorer input consistent, including in-place edits after an ordinary incremental save. Failed-save cleanup completes before a queued sibling write starts.
