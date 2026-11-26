---
'@mastra/inngest': patch
---

Fixed the stream of a resumed Inngest agent run. After a tool approval or a resume, it repeated the earlier events with the old approval request and closed without an answer. It now has only the new events.
