---
'@mastra/mcp': patch
---

Validate MCP tool input schemas before creating executable tools. Live discovery and bulk cached-definition hydration now skip invalid tools with a server/tool-specific warning instead of forwarding malformed schemas to a model. Explicit single-definition hydration rejects invalid schemas with `MCP_CLIENT_INVALID_TOOL_INPUT_SCHEMA`; raw serializable catalogs are unchanged.

Validation supports draft-07, 2019-09, and 2020-12, preserves references and extension keywords without fetching remote schemas, and accepts undialected schemas under draft-07 or 2020-12. Unsupported explicit dialects are skipped with a diagnostic rather than coerced or repaired.
