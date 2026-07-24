---
'@mastra/mcp': patch
---

Fixed MCP tools with outputSchema to send LLM-facing content text to the model via toModelOutput while keeping structuredContent on tool.execute() results.
