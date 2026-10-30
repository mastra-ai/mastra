---
'@mastra/code-sdk': patch
---

Fixed one stalled MCP server keeping every MCP server stuck on "connecting...". Each server now connects and reports its status and tools on its own, so healthy servers show as connected as soon as they are ready. A server that has not connected and listed its tools within 60 seconds is reported as failed with a timeout error; reconnect it from `/mcp` once it is ready.
