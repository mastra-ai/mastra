---
'@mastra/core': patch
---

Fixed output guardrails leaving blocked replies in memory. When an output processor aborts in `processOutputResult`, the agent now removes the response messages that run already saved. The blocked text no longer stays in memory and is not sent back to the model on the next turn. This affected turns that paused for tool approval (approved or declined) and any turn run with `savePerStep: true`. The user's message and earlier turns are kept. Fixes #26215.
