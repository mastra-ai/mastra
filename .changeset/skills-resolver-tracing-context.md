---
'@mastra/core': minor
---

Added tracing to dynamic agent skills resolvers. The resolver now runs inside a `resolve-skills` span, so skills fetched from an external service show up in the agent's trace instead of disappearing, and it receives `tracingContext` for creating child spans of its own — the same pattern tools already use.

```typescript
const agent = new Agent({
  skills: async ({ requestContext, tracingContext }) => {
    const span = tracingContext?.currentSpan?.createChildSpan({
      type: 'generic',
      name: 'entitlements-lookup',
    })
    const skills = await fetchSkillsFor(requestContext.get('userId'))
    span?.end()
    return skills
  },
})
```

On metadata reads such as `agent.listSkills()` no agent is running, so `tracingContext.currentSpan` is `undefined` — guard span usage with `?.` as shown above.
