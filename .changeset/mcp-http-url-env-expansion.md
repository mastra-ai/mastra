---
'mastracode': patch
---

Fixed MCP HTTP server URLs so `${VAR}` references resolve from the environment, the same way header values already do. A server configured with `"url": "${MCP_SERVER_URL}"` is now connected instead of being silently skipped as an invalid URL.
