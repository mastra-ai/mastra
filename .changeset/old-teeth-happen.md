---
'@mastra/memory': patch
---

Fixed a bug where async buffered observations generated stale continuation hints (suggested response and current task) that would be injected into the agent's context on the next turn, causing the agent to reply to old messages or work on already-completed tasks.
