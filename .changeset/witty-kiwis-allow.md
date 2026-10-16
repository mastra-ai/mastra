---
'@mastra/core': patch
---

Fixed goal judges and subagents hanging inside an Agent Controller session. They now run on their own memory thread instead of being bound to the session's thread, which they were waiting on.
