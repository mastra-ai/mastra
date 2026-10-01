---
'@mastra/inngest': patch
---

Fixed Studio's Approve and Decline buttons for Inngest agents. `sendToolApproval()` now resumes the suspended run on Inngest instead of failing with "could not find a suspended run".
