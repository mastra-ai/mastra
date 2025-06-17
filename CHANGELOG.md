# Changelog

## [Unreleased]

### 🐛 Bug Fixes

#### MCP Client Schema Conversion and Parameter Passing

**Fixed critical issues preventing MCPClient from working with complex MCP servers like DataForSEO:**

1. **Schema Conversion Fallback**: When `convertJsonSchemaToZod` fails on complex schemas (e.g., schemas with `anyOf`, nested arrays), the client now gracefully falls back to a permissive schema instead of throwing errors.

2. **Parameter Passing**: Fixed issue where failed schema conversion resulted in `undefined` parameters being sent to MCP servers. The client now ensures parameters are never `undefined`.

3. **Enhanced Logging**: Improved error reporting and debugging information for schema conversion issues.

**Impact**:
- ✅ Enables MCPClient to work with sophisticated MCP servers like DataForSEO
- ✅ Maintains backward compatibility with existing simple MCP servers
- ✅ Provides better debugging information for schema-related issues

**Technical Details**:
- Modified `convertInputSchema()` to use `z.object({}).passthrough()` as fallback
- Enhanced parameter validation in tool execution
- Added comprehensive test coverage for complex schema scenarios

**Breaking Changes**: None - this is a backward-compatible improvement.

---

## Previous Releases

[Previous changelog entries would go here...]