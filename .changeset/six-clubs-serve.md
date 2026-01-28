---
'@mastra/core': patch
---

Fixed RequestContext type variance issue. Users can now pass typed RequestContext<T> instances to agent and workflow methods without TypeScript compilation errors.

**Before:**

```typescript
const ctx = new RequestContext<{ userId: string }>();
ctx.set('userId', '123');

// ❌ TypeScript error: Type 'RequestContext<{ userId: string }>'
// is not assignable to type 'RequestContext<unknown>'
await agent.generate(messages, { requestContext: ctx });
```

**After:**

```typescript
const ctx = new RequestContext<{ userId: string }>();
ctx.set('userId', '123');

// ✅ Works! No more TypeScript errors
await agent.generate(messages, { requestContext: ctx });
await workflow.start({ requestContext: ctx });
```

This fix changes method signatures to accept `RequestContext<any>`, which resolves the type variance issue. TypeScript allows `RequestContext<T>` to be passed where `RequestContext<any>` is expected, maintaining backward compatibility with untyped RequestContext instances.

Closes https://github.com/mastra-ai/mastra/issues/12182
