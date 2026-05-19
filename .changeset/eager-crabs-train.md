---
'@mastra/auth-workos': minor
---

FGA `check()` and `require()` now accept an array of permissions and short-circuit on the first one that resolves to allow (ANY-of semantics). Single-permission usage continues to work unchanged.

```ts
// Before — one permission per call
await fgaProvider.check({
  user,
  resource: { type: 'agent', id: 'abc' },
  permission: 'agents:read',
});

// After — single permission or ANY-of array
await fgaProvider.check({
  user,
  resource: { type: 'agent', id: 'abc' },
  permission: ['agents:read', 'agents:execute'],
});
```

When all permissions in the array are denied, the thrown `FGADeniedError` lists them as `any of [a, b, c]` in its message.
