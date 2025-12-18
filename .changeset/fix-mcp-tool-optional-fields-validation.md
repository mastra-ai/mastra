---
'@mastra/core': patch
---

Fix MCP tool input validation treating optional fields as required. Previously, tool execution would fail when optional schema fields were omitted, even though they were not listed in the schema's "required" array. The input normalization logic now correctly handles optional fields, allowing tools to execute successfully when only required fields are provided.

Fixes #11016