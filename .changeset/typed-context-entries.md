---
'@mastra/core': patch
---

Improve RequestContext type inference for entries(), keys(), values(), and forEach()

The `entries()` method now returns a discriminated union of tuples, enabling proper type narrowing when iterating:

```typescript
const context = new RequestContext<{ name: string; age: number }>();

for (const [key, value] of context.entries()) {
  if (key === 'age') {
    // value is now correctly inferred as `number`
  }
}
```

Fixes #4467

