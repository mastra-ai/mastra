---
'@mastra/editor': patch
---

Builder agents keep their own stability error processors (`ProviderHistoryCompat`, `PrefillErrorHandler`, `StreamErrorRetryProcessor`) instead of relying on the framework defaults, because the `@mastra/core` peer range allows cores that predate them — so the builder's recovery stack holds on every supported core version. A caller's `errorProcessors` array merges with the builder's list: defaults the caller replaces by `id` are dropped in favor of the caller's instance, other caller processors run after the defaults, and an explicit `errorProcessors: []` opts out — so adding a processor never costs the builder its recovery:

```ts
createBuilderAgent({ errorProcessors: [myProcessor] });
// resolved: provider-history-compat, prefill-error-handler,
// stream-error-retry-processor, myProcessor
```

The processors are declared in the repair-first order the framework uses. A function-valued `errorProcessors` override is passed through unchanged, so a callback must return every processor it needs, including any builder defaults. `DEFAULT_BUILDER_ERROR_PROCESSORS` is still exported.
