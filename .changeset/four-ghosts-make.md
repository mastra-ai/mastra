---
'@mastra/ai-sdk': patch
---

Fixed extractV6NativeApproval to pick the most recent approval-responded tool part within a trailing assistant message. Earlier, when one message accumulated multiple approval-responded parts across sequential resume cycles, the resume flow used the oldest stale decision instead of the one the user just acted on. Closes #17899.
