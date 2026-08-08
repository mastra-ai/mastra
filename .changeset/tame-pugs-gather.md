---
'@mastra/core': minor
---

Add `includeResolvedTools` to `ToolSearchProcessor`, making per-request tools (MCP tools that need the caller's credentials, or anything returned by a dynamic `tools` function) searchable and withholding them from the prompt until the agent loads them. Previously only tools listed at construction could be searched, so dynamically resolved tools were always sent in full.
