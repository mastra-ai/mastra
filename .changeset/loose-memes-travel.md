---
'@mastra/mcp': patch
---

Fixed MCP tools not validating structured tool results against the tool's output schema. Tools rebuilt from a cached catalog with toolFromDefinition / toolsFromDefinitions (and live-discovered tools whose result bypasses the SDK check) now validate structuredContent before it reaches the model, and return the same structured validation error that createTool produces on mismatch. Valid results, in-band tool errors, and results without structuredContent are unchanged. Fixes https://github.com/mastra-ai/mastra/issues/22549
