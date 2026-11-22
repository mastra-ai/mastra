---
'@mastra/playground-ui': patch
---

`useChatSend()` now returns the same function for as long as the chat is mounted. Components can keep it, or list it as a dependency, without it changing on every streamed chunk.
