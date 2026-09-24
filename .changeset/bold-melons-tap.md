---
'@mastra/core': minor
---

Every agent now recovers from transient provider failures, assistant-prefill rejections, and provider history incompatibilities with no configuration. Three error processors — `ProviderHistoryCompat`, `PrefillErrorHandler`, and `StreamErrorRetryProcessor` — are on by default, in the order that repairs history before anything retries. A `ProviderHistoryCompat` in `errorProcessors` now also repairs the outbound prompt before the provider sees it, instead of only reacting to a rejection.

You stay in control of the list:

```ts
// Replace one default: your instance with the same id takes its slot.
new Agent({ ..., errorProcessors: [new StreamErrorRetryProcessor({ maxRetries: 5 })] })

// Run only your own processors — none of the defaults are merged in.
new Agent({ ..., errorProcessors: [myProcessor], errorProcessorDefaults: false })

// Run with no error processors at all.
new Agent({ ..., errorProcessors: [] })
```

The default retry processor does not retry unmatched errors. Transient failures still recover through provider `isRetryable` metadata or the built-in matchers, and a bad-request (HTTP 400) response is retried once after 2s in case it was transient — but other deterministic failures, like a rejected structured-output attempt or a validation error, are no longer replayed. Pass `StreamErrorRetryProcessor({ retryUnknownErrors: true })` in `errorProcessors` to opt back in. `createCodingAgent` keeps retrying unmatched errors, as it always has.

Error-processor retries are bounded by a safety cap of `3` per turn when you don't set `maxProcessorRetries`; the defaults stop well below it on their own. The "errorProcessors are configured without an explicit maxProcessorRetries" warning now fires only when you configured error processors yourself, not for the framework defaults.
