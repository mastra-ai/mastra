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

// ✅ Works! Type information preserved
await agent.generate(messages, { requestContext: ctx });
await workflow.start({ requestContext: ctx });
```

This fix uses generic type parameters instead of hardcoded `any`, preserving type information while maintaining backward compatibility with untyped RequestContext instances.

Closes https://github.com/mastra-ai/mastra/issues/12182
