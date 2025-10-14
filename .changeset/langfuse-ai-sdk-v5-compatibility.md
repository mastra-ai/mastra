---
'@mastra/langfuse': patch
---

Add AI SDK v5 compatibility to Langfuse exporter while maintaining backward compatibility with v4

**Features:**
- Normalize token usage to handle both AI SDK v4 format (`promptTokens`/`completionTokens`) and v5 format (`inputTokens`/`outputTokens`)
- Support AI SDK v5-specific features:
  - Reasoning tokens for models like o1-preview
  - Cached input tokens (prompt cache hit)
  - Enhanced cache metrics
- Automatic detection and normalization of token formats with v5 taking precedence
- Comprehensive type definitions with JSDoc annotations indicating version compatibility

**Technical Changes:**
- Added `NormalizedUsage` interface with detailed version documentation
- Implemented `normalizeUsage()` method using nullish coalescing (`??`) to safely handle both formats
- Added 8 new test cases covering v4/v5 compatibility scenarios
- Updated documentation with AI SDK v5 compatibility guide

**Breaking Changes:** None - fully backward compatible with existing AI SDK v4 implementations

