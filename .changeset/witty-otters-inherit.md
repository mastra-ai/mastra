---
'@mastra/editor': patch
---

Builder agents keep their own stability error processors (`ProviderHistoryCompat`, `PrefillErrorHandler`, `StreamErrorRetryProcessor`) instead of relying on the framework defaults, because the `@mastra/core` peer range allows cores that predate them — so the builder behaves the same on every supported core version. The processors are declared in the repair-first order the framework uses, and `maxProcessorRetries: 3` is set explicitly to match the runtime's implicit safety cap. `DEFAULT_BUILDER_ERROR_PROCESSORS` is still exported.
