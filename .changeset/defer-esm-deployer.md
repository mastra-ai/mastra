---
'@mastra/deployer': major
---

**Breaking:** Workspace dependency collection now returns a promise.

Before:

```ts
const dependencies = collectTransitiveWorkspaceDependencies(options);
```

After:

```ts
const dependencies = await collectTransitiveWorkspaceDependencies(options);
```

This lets CommonJS deployments defer ESM-only package-name normalization.
