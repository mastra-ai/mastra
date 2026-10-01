---
'@mastra/memory': minor
---

Added per-provider idle activation TTLs to observational memory. Pass an object to `activateAfterIdle` to set a TTL for specific providers and a `default` for the rest. Use this when your requests set a prompt cache TTL that `'auto'` can't detect, such as Anthropic's per-message `cacheControl: { ttl: '1h' }`.

**Before**

```ts
// 'auto' uses 5 minutes for Anthropic, so a 1-hour cache is dropped after 5 idle minutes
observationalMemory: {
  activateAfterIdle: 'auto',
}
```

**After**

```ts
observationalMemory: {
  activateAfterIdle: { default: 'auto', anthropic: '1h' },
}
```

Keys match the model's provider before the first `.` (so `anthropic` matches `anthropic.messages`), case-insensitively. Each value takes the same forms as before: milliseconds, a duration string, `'auto'`, or `false`. Existing single-value settings behave exactly as before.
