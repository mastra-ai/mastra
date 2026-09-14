---
'@mastra/react': patch
---

Fixed delayed chat history responses overwriting streamed messages, including after completion. Restore saved tasks and pending tool approvals during active runs without overwriting newer live updates or restoring resolved approvals.
