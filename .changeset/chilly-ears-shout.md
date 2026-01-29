---
'@mastra/server': patch
---

Fixed server handlers to find stored and sub-agents, not just registered agents. Agents created via the API or stored in the database are now correctly resolved in A2A, memory, scores, tools, and voice endpoints.
