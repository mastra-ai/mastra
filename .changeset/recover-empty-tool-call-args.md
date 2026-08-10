---
'@mastra/core': patch
---

Preserve client-tool call arguments in stored messages. When a tool result was persisted without its originating tool call, its arguments were saved as an empty object; on later turns the model saw an argument-less call in its own history and began emitting empty-argument tool calls. `MessageList` now backfills the arguments from the originating call as messages are added, so the stored conversation stays correct for every reader rather than only being repaired while building the prompt.
