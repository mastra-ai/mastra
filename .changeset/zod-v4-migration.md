---
"@mastra/core": minor
"@mastra/mcp-docs-server": minor
"@mastra/mcp-registry-registry": minor
"@mastra/memory": minor
"@mastra/schema-compat": minor
"@mastra/server": minor
"@mastra/client-js": minor
---

feat: complete Zod v4 migration with dual version support

Implements comprehensive Zod v3/v4 dual compatibility following official library authors guidance:

- **Non-breaking**: Supports both Zod v3 and v4 through peer dependencies
- **Runtime detection**: Uses official `"_zod" in schema` pattern for version detection
- **Graceful fallbacks**: v4 native methods with v3 library fallbacks
- **Schema preservation**: Maintains validation behavior across versions
- **Type safety**: Proper union types and safe property access

Key utilities added:
- `safeToJSONSchema()`: Dual-version JSON schema conversion
- `safeValidate()`: Corruption-resistant validation
- `safeGetSchemaProperty()`: v3/v4 compatible property access

Fixes #5821 - resolves all schema validation corruption issues while maintaining backward compatibility.