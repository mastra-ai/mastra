---
'@mastra/core': patch
---

Signed thinking blocks produced by one Anthropic-compatible provider are no longer replayed to a different provider when a thread switches models (for example Kimi For Coding ↔ `anthropic/claude-sonnet-4-6`); the receiving provider rejected the foreign signature and the thread got stuck.
