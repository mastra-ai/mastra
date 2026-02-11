---
'@mastra/ai-sdk': patch
---

Fixed missing `state` field in `data-tool-call-approval` and `data-tool-call-suspended` stream chunks. Frontend consumers can now use the `state` property on the data payload to identify the part's state consistently with other tool UI parts.
