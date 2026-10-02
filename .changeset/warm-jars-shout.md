---
"@mastra/server": minor
---

Added a built-in Studio MCP App for browsing and filtering traces on public Mastra servers. The UI ships with Mastra Server and exposes an open_studio launch tool.

Connect an MCP Apps host to https://your-server.example/api/studio/mcp, open Studio, and confirm the public server URL. The app supports date ranges, filters, columns, sorting, and pagination without a separate UI deployment.

Requires @mastra/core 1.68 or newer. Authentication and trace details are not included in this preview.
