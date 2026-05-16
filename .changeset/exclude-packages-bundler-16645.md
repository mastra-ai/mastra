---
'@mastra/core': minor
'@mastra/deployer': minor
---

Added a `bundler.excludePackages` option to force-exclude packages from the generated `package.json` even when dependency analysis flagged them as in use. Useful when conditional dynamic imports (e.g. a dev-only `await import('@mastra/libsql')` gated by `process.env.NODE_ENV`) are tree-shaken out of the production bundle but still surface as dependencies. Addresses the "escape hatch" half of [#16645](https://github.com/mastra-ai/mastra/issues/16645).

```typescript
export const mastra = new Mastra({
  bundler: {
    excludePackages: ['@mastra/libsql'],
  },
});
```
