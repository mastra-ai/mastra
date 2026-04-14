---
"@mastra/deployer-cloudflare": patch
---

Pass `env` to the user-exported `mastra` factory in the generated Worker entry, and let users opt into an explicit `(env) => new Mastra(...)` factory pattern.

Previously, the Cloudflare deployer's auto-generated entry called `mastra()` without arguments, which meant user code had no way to access Cloudflare runtime bindings (`env.D1Database`, `env.MY_KV`, etc.) when constructing storage adapters. Users were forced to work around this with global state and request middleware.

Now two patterns are supported:

```ts
// Pattern A (existing, unchanged) — auto-wrapped to () => new Mastra(...)
export const mastra = new Mastra({ /* ... */ });

// Pattern B (new) — explicit factory receives env
export const mastra = (env) =>
  new Mastra({
    storage: new D1Store({ binding: env.D1Database }),
    /* ... */
  });
```

Backward compatible: the auto-wrapped form continues to work and silently ignores the new env argument.
