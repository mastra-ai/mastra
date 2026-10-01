---
'@mastra/core': patch
---

When a sealed assistant message is added again with its tool call resolved, the result is now recorded on the existing call instead of the whole message being copied under a new id. Copying it sent the message's signed thinking twice, which Anthropic rejects with "'thinking' or 'redacted_thinking' blocks in the latest assistant message cannot be modified".
