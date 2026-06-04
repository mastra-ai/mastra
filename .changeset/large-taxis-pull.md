---
'mastracode': patch
---

Fixed thread isolation bug where /new command did not abort the running stream, causing events from the old thread (subagent results, tool approvals, task updates) to leak into the new conversation.
