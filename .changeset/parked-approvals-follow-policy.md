---
'@mastra/core': patch
---

Tool calls waiting on approval now follow the current permission rules. When a tool is set to allow or deny after its call already paused, or a session is reopened by another process, the waiting call is approved or declined instead of waiting for a click that never comes. Tool permission rules are also saved with the thread, so a reopened session keeps them.
