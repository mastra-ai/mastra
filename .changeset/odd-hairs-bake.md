---
'@mastra/code-sdk': minor
---

Removed cross-scope credential fallback in deployed sessions so each session uses only Factory or user credentials.

Custom credential store providers must replace `orgFirst` with an explicit `credentialScope`:

```ts
// Before
const tenant = { orgId, userId, orgFirst: true };

// After
const tenant = { orgId, userId, credentialScope: 'factory' as const };
```

Use `"user"` to resolve only personal credentials.
