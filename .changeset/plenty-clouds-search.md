---
'@mastra/server': patch
---

Fixed detached stream detection to use the agent's stream capability rather than its execution type, preserving runs when an HTTP observer disconnects.
