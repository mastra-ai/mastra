---
'@mastra/connect': minor
---

Added automatic discovery of MCP-backed integrations from the Mastra Platform catalog. Connected MCP providers require no checked-in provider registration: `connect()` discovers their tools through Platform, keeps provider credentials outside the application process, and preserves Platform proxy analytics. Discovered MCP tools require tool approval unless the application lists them in `autoApproveTools`.
