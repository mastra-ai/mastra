---
'@mastra/mcp': minor
---

Added support for passing custom \_meta metadata when calling tools on external MCP servers. The execute context now accepts an optional \_meta field with arbitrary key-value pairs that are forwarded in the callTool request, enabling use cases like distributed tracing, compliance tagging, and multi-tenant routing. Custom \_meta is merged with the progress token when progress tracking is enabled.

```typescript
const tools = await mcpClient.tools();
await tools['my_tool'].execute(
  { query: 'active users' },
  { _meta: { traceId: 'span-456', tenantId: 'org-123' } }
);
```

When `enableProgressTracking` is enabled, the `progressToken` is automatically merged into `_meta` alongside your custom fields.
