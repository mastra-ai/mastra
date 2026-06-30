---
"@mastra/memory": patch
---

Expose `providerMetadata` on Observational Memory `ObserveHooks` results

`onObservationEnd` and `onReflectionEnd` now receive the OM model call's `providerMetadata` alongside `usage`, so you can read per-call provider details — for example the AI Gateway's cost and generation id — straight from the hook instead of wrapping the observer/reflector models in a model-stream middleware:

```ts
const hooks: ObserveHooks = {
  onObservationEnd: ({ usage, providerMetadata }) => {
    const gateway = providerMetadata?.gateway;
    recordCost({ tokens: usage?.totalTokens, cost: gateway?.cost, generationId: gateway?.generationId });
  },
  onReflectionEnd: ({ usage, providerMetadata }) => {
    recordCost({ tokens: usage?.totalTokens, cost: providerMetadata?.gateway?.cost });
  },
};
```

The field is additive and optional, and is omitted entirely when the provider emits no metadata, so existing hook consumers are unaffected. For batched observations and multi-attempt reflections it reflects the last batch/attempt that emitted provider metadata.
