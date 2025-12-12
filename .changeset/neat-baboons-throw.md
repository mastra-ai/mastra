---
'@mastra/client-js': patch
---

Deserialize workflow errors on the client side

When workflows fail, the server sends error data as JSON over HTTP. This change deserializes those errors back to proper `Error` instances on the client.

**Before:**
```typescript
const result = await workflow.startAsync({ input });
if (result.status === 'failed') {
  // result.error was a plain object, couldn't use instanceof
  console.log(result.error.message); // TypeScript error
}
```

**After:**
```typescript
const result = await workflow.startAsync({ input });
if (result.status === 'failed') {
  // result.error is now a proper Error instance
  if (result.error instanceof MyCustomError) {
    console.log(result.error.statusCode); // Works!
  }
}
```

This enables proper error handling and type checking in client applications, allowing developers to implement error-specific recovery logic based on custom error types and properties.

Features:
- `instanceof Error` checks
- Access to `error.message`, `error.name`, `error.stack`
- Preservation of custom error properties (e.g., `statusCode`, `responseHeaders`)
- Nested error tracking via `error.cause`

Affected methods:
- `startAsync()`
- `resumeAsync()`
- `restartAsync()`
- `timeTravelAsync()`
