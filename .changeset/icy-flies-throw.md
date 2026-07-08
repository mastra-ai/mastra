---
'@mastra/core': minor
---

Added the ability to explicitly disable a storage domain on `MastraCompositeStore` by setting it to `false` in the `domains` config. A disabled domain no longer falls back to the `editor` or `default` store, so writes for that domain are dropped instead of silently landing in the fallback database.

```ts
const storage = new MastraCompositeStore({
  id: 'my-storage',
  default: libsqlStore,
  domains: {
    // don't persist traces/metrics when observability is turned off
    observability: false,
  },
});
```

`prune()` also accepts a per-call `retention` option that replaces the configured retention policies for that call only — for example to skip a domain (keep chat history) or prune more aggressively without reconstructing the store:

```ts
// prune everything except the memory domain, one time
await storage.prune({
  retention: {
    observability: { spans: { maxAge: '14d' } },
  },
});
```
