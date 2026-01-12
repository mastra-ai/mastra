---
'@mastra/core': minor
---

Add support for MCP tool annotations and metadata (Issue #9859)
Add annotations field to ToolAction interface for MCP tool behavior hints (title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
Add \_meta field to ToolAction interface for arbitrary metadata passthrough
Add ToolAnnotations type export for type-safe annotation configuration
Update Tool class to store and expose annotations and meta fields
Update CoreTool and InternalCoreTool types to include annotations and meta
