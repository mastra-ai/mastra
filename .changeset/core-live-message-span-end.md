---
'@mastra/core': patch
---

The agent controller's live message now closes a text or reasoning span on `text-end` / `reasoning-end`. A later step that reuses the provider's block id opens a new part instead of appending to the earlier one, so the live message keeps the same part order as the persisted one.
