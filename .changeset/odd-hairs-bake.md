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

Use `"user"` to resolve only personal credentials. Hosts that select credentials for a session owner rather than the signed-in caller can register an asynchronous policy resolver as the second argument to `setCredentialStoreProvider`. Resolve that policy from authenticated identity and durable session records, not client-writable session state. Call `prepareCredentialTenant(requestContext)` before resolving a model; the SDK’s built-in model, memory, and goal-judge resolvers do this automatically and refresh the policy again before provider calls.
