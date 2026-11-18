---
'@mastra/factory': patch
---

Fixed a sent message disappearing from the chat when the page was reloaded before the agent had stored it. The message now shows once, after the stored history, until the stored copy replaces it.
