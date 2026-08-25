---
'@mastra/core': patch
---

Fixed `session.thread.firstUserMessage()` and `firstUserMessages()` returning nothing for agent-controller sessions. A live session persists a chat message as a `user` signal rather than a `user` row, and the lookup only matched the latter, so it came back empty for every real session.

Added `isUserAuthoredMessage()` for the same check anywhere else, and sessions now emit a `thread_title_updated` event when a generated title lands on the thread.
