---
'@mastra/mcp': minor
---

Add support for RequestOptions in elicitation requests to allow custom timeouts and request cancellation.

You can now pass RequestOptions when sending elicitation requests:

```typescript
// Within a tool's execute function
const result = await options.mcp.elicitation.sendRequest(
  {
    message: 'Please provide your email',
    requestedSchema: {
      type: 'object',
      properties: { email: { type: 'string' } },
    },
  },
  { timeout: 120000 } // Custom 2-minute timeout
);
```

The RequestOptions parameter supports:
- `timeout`: Custom timeout in milliseconds (default: 60000ms)
- `signal`: AbortSignal for request cancellation

Fixes #10834

