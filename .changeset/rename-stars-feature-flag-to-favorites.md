---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Rename the `stars` agent-builder feature flag to `favorites`.

The flag now matches the rest of the favorites surface (storage tables,
storage methods, HTTP routes, SDK methods, and UI components all use
`favorite`/`favorites`).

The previous `stars` key had no functional consumers in any released
version — it was declared on `AgentFeatures` and defaulted to `true`, but
no handler, route, or UI on `main` ever read it. Removing it is a
cosmetic breaking change with no behavioral impact on existing apps.

```ts
// Before
mastra.editor({
  builder: {
    agent: {
      features: { stars: true },
    },
  },
});

// After
mastra.editor({
  builder: {
    agent: {
      features: { favorites: true },
    },
  },
});
```
