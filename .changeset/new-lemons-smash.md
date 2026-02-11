---
'@mastra/server': patch
---

Fixed requestContextSchema missing from the agent list API response. Agents with a requestContextSchema now correctly include it when listed via GET /agents.
