---
'@mastra/core': patch
---

Fixed the `messageFilter` and `onDelegationStart` delegation types to match the messages they actually receive. Both now receive AI SDK model messages (`ModelMessage[]`) — the processor-adjusted prompt the supervisor model saw, including system messages, with tool calls removed — and `messageFilter` returns `ModelMessage[]`. Previously they were typed as stored database messages, so filters reading fields like `content.parts` or `id` could silently let parent context through. Update filters to read `role` and `content`. Fixes [#25983](https://github.com/mastra-ai/mastra/issues/25983).
