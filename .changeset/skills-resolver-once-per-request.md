---
'@mastra/core': patch
---

Fixed dynamic `skills` resolvers running four times per agent request. Skills are needed in several places during one execution, and each of them called your resolver again — so a resolver that fetches over the network made four calls per request instead of one.

```typescript
const agent = new Agent({
  name: 'support',
  instructions: 'Help the customer.',
  model: 'openai/gpt-5-mini',
  skills: async ({ requestContext }) => {
    // Called four times per generate()/stream() before this change, once now.
    const res = await fetch(`https://internal/skills?user=${requestContext.get('userId')}`);
    return (await res.json()).skills;
  },
});
```

The resolution is now shared across a request, keyed on its `RequestContext`. A new request resolves again, and a failed resolution is not cached so a retry still reaches your resolver. If you reuse a single `RequestContext` across several executions, those executions now share one resolution.
