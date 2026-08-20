---
'@mastra/core': patch
---

Added each tool call's serialized input schema to `TOOL_CALL` and `MCP_TOOL_CALL` tracing span attributes. Custom observability exporters can now inspect the schema without access to the registered tool.

```typescript
import { SpanType, type ExportedSpan } from '@mastra/core/observability';

function readInputSchema(span: ExportedSpan<SpanType.TOOL_CALL> | ExportedSpan<SpanType.MCP_TOOL_CALL>) {
  return span.attributes?.inputSchema ? JSON.parse(span.attributes.inputSchema) : undefined;
}
```
