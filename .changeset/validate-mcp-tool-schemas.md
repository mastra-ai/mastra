---
"@mastra/mcp": patch
---

Normalize misplaced string-array `required` lists in MCP tool input schemas before creating tools. Preserve valid properties named `required` and existing top-level requirements without mutating server-supplied or cached schemas. This handles the misplaced-list case only; it does not provide general schema validation or invalid-tool isolation.
