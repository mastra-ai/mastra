---
'@mastra/mcp': patch
---

Fixed MCP task tool calls failing when a server sends a valid ISO 8601 `createdAt` that JavaScript can't parse, such as `20261029T120000Z`. The client now accepts it and counts the task's TTL from when it started waiting.

The client also caps the wait between polls at the task's TTL, so it no longer polls up to one poll interval after the TTL ends.
