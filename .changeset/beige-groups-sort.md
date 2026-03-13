---
'@mastra/mcp': patch
---

Updated @modelcontextprotocol/sdk from ^1.17.5 to ^1.27.1. The `version` field on MCP prompts is now deprecated — it was never part of the official MCP wire protocol and will be removed in a future release. Use distinct prompt names instead of versioning. The `MastraPrompt` type (extending `Prompt` with an optional `version`) is available for migration but is also deprecated.
