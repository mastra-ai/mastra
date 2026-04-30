---
'@mastra/core': minor
---

Added top-level `environment` config on `Mastra` to tag observability signals with the deployment environment.

Set it once on the `Mastra` instance and it will be attached to all observability signals automatically. Falls back to `process.env.NODE_ENV` when unset; per-call `tracingOptions.metadata.environment` still takes precedence.

**Before**

```ts
await agent.generate('hello', {
  tracingOptions: { metadata: { environment: process.env.NODE_ENV } },
});
```

**After**

```ts
new Mastra({
  environment: 'production',
  observability: new Observability({ ... }),
})
```

`mastra.getEnvironment()` returns the resolved value.
