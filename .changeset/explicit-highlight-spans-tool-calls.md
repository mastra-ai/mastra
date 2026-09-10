---
'@mastra/playground': patch
---

Fixed the advanced thread view so expanding a tool call no longer silently highlights its spans in the trace timeline. Each tool call now shows its own "Highlight spans" icon action on the badge header line, and text messages show the same icon next to Copy, so highlighting is always an explicit choice. Highlighting only fades the unrelated spans; it no longer opens the span detail panel.
