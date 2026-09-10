---
'@mastra/playground': patch
---

Fixed the advanced thread view so expanding a tool call no longer silently highlights its spans in the trace timeline. Each tool call now shows its own "Highlight spans" action, matching text messages, so highlighting is always an explicit choice.
