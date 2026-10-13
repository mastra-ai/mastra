---
'@mastra/core': patch
---

Fixed output guardrails leaving blocked replies in memory. When an output processor aborts in `processOutputResult`, the agent (including durable agents) now deletes the reply messages that the run had already saved. The blocked text no longer stays in memory and is not sent back to the model on the next turn. This affected turns that paused for tool approval (approved or declined) and turns run with `savePerStep: true`. The user's message, earlier turns, and messages sent in as input are kept. Fixes #26215.
