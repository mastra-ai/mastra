---
'@mastra/server': patch
---

Fixed the tools API endpoint to include dynamically created tools (e.g., MCP tools) alongside bundler-discovered tools. Previously, when the CLI bundler discovered tools, dynamically created tools registered via `new Mastra({ tools })` were silently dropped from the `/api/tools` response. Now both sources are merged, with bundler-discovered tools taking precedence on conflicts.
