---
'@mastra/mcp-docs-server': patch
---

Moved the docs server onto @mastra/mcp 2.x: tools are defined with `createTool`, migration prompts no longer carry the deprecated `version` field, and process logs go to the local log file (MCP 2026-07-28 delivers logs per request rather than per session).
