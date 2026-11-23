---
'@mastra/playground-ui': patch
---

`useChatSend()` now returns the same function for as long as the chat is mounted. Components can keep it, or list it as a dependency: it no longer changes on every streamed chunk, and it always sends with the chat's current agent and settings.
