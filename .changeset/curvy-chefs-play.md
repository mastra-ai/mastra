---
'@mastra/server': patch
---

Accept both MCP server families from the core registry. Legacy SSE routes stay available for MCP 1.x servers and return 404 for 2.x servers, and the REST tool execute route reports a tool that suspended for input as `{ status: 'suspended', suspendPayload, resumeSchema }` instead of pretending it completed.
