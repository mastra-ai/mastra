---
'@mastra/core': patch
---

Added optional `TContext` generic to `DynamicArgument` type, allowing typed `requestContext` in dynamic callbacks:

```typescript
type MyContext = { userId: string; tenantId: string };

// Before: requestContext.get() returns unknown
type UnTyped = DynamicArgument<string>;

// After: requestContext.get('userId') returns string
type Typed = DynamicArgument<string, MyContext>;
```
