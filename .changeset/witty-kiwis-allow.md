---
'@mastra/core': patch
---

Fixed goal judges and subagents hanging inside an Agent Controller session. Previously they inherited the session's memory thread and waited on it forever. Goal judges now use their own goal-specific thread. Forked subagents use the cloned thread. Non-forked subagents no longer inherit the session's thread and resource IDs.
