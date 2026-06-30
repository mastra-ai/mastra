---
'@mastra/mcp': patch
---

Fixed @mastra/mcp crashing Cloudflare Workers at module initialization. MCPClient can now be safely imported on workerd without the Worker failing to start.
