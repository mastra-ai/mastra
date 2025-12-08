---
"@mastra/core": patch
---

fix: preserve system messages when prepareStep returns messages

Match AI SDK v5 behavior where system is handled separately from messages.
When prepareStep returns messages without a system override, the original
system messages are preserved instead of being lost.
