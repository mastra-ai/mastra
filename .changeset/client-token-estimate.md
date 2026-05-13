---
'@mastra/memory': patch
---

Added a public escape hatch so callers can supply an authoritative token estimate for file parts whose binary payload has been stripped before persistence (for example, files uploaded to cloud storage with a hidden reference token left in `data` and re-hydrated by LLM middleware before inference).

For those pipelines TokenCounter has no on-device file size to measure, so Observational Memory thresholds and context budgets undercount large attachments. Callers can now stamp an estimate directly on the part:

```ts
part.providerMetadata = {
  mastra: {
    tokenEstimate: { v: 0, source: 'client', key: 'client', tokens: 25_000 },
  },
};
```

When present, TokenCounter returns those tokens from both the sync and async paths and skips provider fetches. Invalid entries (NaN, negative, non-numeric) fall through to the default estimator. Parts without a client estimate are unaffected.

Related to https://github.com/mastra-ai/mastra/issues/16522
