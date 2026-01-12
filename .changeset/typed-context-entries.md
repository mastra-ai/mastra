---
'@mastra/core': patch
---

Fix TypeScript type narrowing when iterating over typed RequestContext

The `set()` and `get()` methods on a typed `RequestContext` already provide full type safety. However, when iterating with `entries()`, `keys()`, `values()`, or `forEach()`, TypeScript couldn't narrow the value type based on key checks.

Now it can:

```typescript
const ctx = new RequestContext<{ userId: string; maxTokens: number }>();

// Direct access:
const tokens = ctx.get('maxTokens'); // number

// Iteration now works too:
for (const [key, value] of ctx.entries()) {
  if (key === 'maxTokens') {
    value.toFixed(0); // TypeScript knows value is number
  }
}
```
