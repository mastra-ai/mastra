---
'@mastra/core': minor
---

Added a `requestContextKeys` option to scorer runs that controls which request-context values are recorded on the eval's span input for repeatability.

Previously the entire request context was recorded on every scorer-run span. Because request context is an arbitrary, app-controlled bag, that could persist secrets or PII stored under any key into exported traces and datasets. Scorer runs now record **nothing** from the request context by default — you opt in per key.

**What changed**

- Default (no `requestContextKeys`): nothing from the request context is recorded.
- Specific keys: only those keys are recorded, with dot notation for nested values.
- `['*']`: the whole context is recorded (the framework-managed auth token stays redacted).

This is separate from the observability config's `requestContextKeys`, which controls live span metadata. Recording a run so it can be reproduced later and surfacing keys on every live span are different concerns, so they are controlled independently.

**Example**

```ts
await scorer.run({
  input,
  output,
  requestContext: { userId: 'u_123', tenant: { id: 't_1', apiKey: 'secret' } },
  // Persist only what you need to reproduce the run — `apiKey` is never stored.
  requestContextKeys: ['userId', 'tenant.id'],
});
```
