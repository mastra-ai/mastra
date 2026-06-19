---
'mastracode': patch
---

Expand `${VAR}` and `${VAR:-default}` references in MCP server HTTP headers. Header values such as `"x-api-key": "${MY_API_KEY}"` in `mcp.json` are now resolved from the environment when the config is loaded, instead of being sent verbatim. This matches how Claude Code reads `.mcp.json` and lets header-authenticated HTTP servers pull secrets from the environment.
