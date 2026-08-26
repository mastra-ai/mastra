---
'@mastra/e2b': patch
'@mastra/daytona': patch
'@mastra/platform-workspace': patch
'@mastra/railway': patch
---

Starting a sandbox now reports whether it created a fresh sandbox or reconnected to an existing one, so an `onStart` handler can run first-time setup only when it's actually needed:

```typescript
new E2BSandbox({
  id: 'session-1',
  onStart: async ({ outcome }) => {
    if (outcome === 'created') await cloneRepo()
  },
})
```
