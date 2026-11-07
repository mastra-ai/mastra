---
'@mastra/server': patch
---

Fixed auth `rules` so the first rule that matches a request decides access. Before, if a matching rule's `condition` returned false, the next rules were still checked, so a broad rule like `{ path: '/api/*', allow: true }` could let a non-admin into a path guarded by an earlier admin-only rule.

If you relied on that fall-through, use `authorize` so each path keeps its own check. A `condition` only sees the user, so merging checks for different paths into one `condition` would widen access.

```ts
// Before: analysts fell through to the second rule
rules: [
  { path: '/api/*', condition: user => user.role === 'admin' },
  { path: '/api/reports/*', condition: user => user.role === 'analyst' },
]

// After — keep each role's path restriction (admins still limited to /api/*)
authorize: async (path, method, user) =>
  (path.startsWith('/api/') && user.role === 'admin') ||
  (path.startsWith('/api/reports/') && user.role === 'analyst'),
```

Async conditions are now awaited, so a `condition` that resolves to `false` or rejects denies access.
