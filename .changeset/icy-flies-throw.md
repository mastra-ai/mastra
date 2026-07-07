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
