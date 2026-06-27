---
'@mastra/mongodb': patch
---

Fixed MongoDB store to use atomic transactions for all multi-collection write operations. Creates, deletes, and updates across agents, mcp-clients, mcp-servers, prompt-blocks, scorer-definitions, skills, workspaces, schedules, and datasets domains are now atomic — preventing orphaned records when a write fails partway through.
