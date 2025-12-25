---
'@mastra/core': patch
---

Fixes #11333

When a tool throws an error during execution, the error was being returned as the result (appearing in `tool-result` chunks) instead of being surfaced as a proper `tool-error` chunk.

Before:

```typescript
for await (const chunk of stream.fullStream) {
  if (chunk.type === 'tool-error') {
    // Never reached - errors appeared in tool-result instead
  }
}
```

After:

```typescript
for await (const chunk of stream.fullStream) {
  if (chunk.type === 'tool-error') {
    console.log(chunk.payload.error.message); // "Tool error"
    console.log(chunk.payload.toolName); // "failingTool"
  }
}
```
