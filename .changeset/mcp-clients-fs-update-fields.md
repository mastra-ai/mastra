---
'@mastra/core': patch
---

Fixed filesystem storage writing MCP client config fields like `name` and `servers` onto the client record during `update()`. Only record-level fields are stored there now; config stays in versions.
