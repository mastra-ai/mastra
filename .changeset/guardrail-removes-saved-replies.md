---
'@mastra/core': patch
---

Fixed output guardrails leaving blocked replies in memory. When an output processor aborts in `processOutputResult`, the agent now removes the response messages that run already saved, so the blocked text is not stored and is not sent back to the model next turn. Two cases were affected: a turn that paused for tool approval (approved or declined), and any turn run with `savePerStep: true`. The user's message and earlier turns are kept. Fixes #26215.
