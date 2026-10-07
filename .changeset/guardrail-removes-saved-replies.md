---
'@mastra/core': patch
---

Fixed output guardrails leaving blocked replies in memory for standard (non-durable) agents. When an output processor aborts in `processOutputResult`, the agent now deletes the reply messages that the run had already saved. The blocked text no longer stays in memory and is not sent back to the model on the next turn. This affected turns that paused for tool approval (approved or declined) and turns run with `savePerStep: true`. The user's message, earlier turns, and messages sent in as input are kept. Durable agents are not covered by this fix. Fixes #26215.
