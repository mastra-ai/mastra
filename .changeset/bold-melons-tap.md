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
new Agent({ ..., errorProcessorDefaults: false })
```

`errorProcessorDefaults: false` is the only opt-out: an empty `errorProcessors` list merges like any other and still gets the defaults.

The default retry processor retries transient failures only. Transient failures recover through provider `isRetryable` metadata or the built-in connection-reset matcher, while deterministic failures — a rejected structured-output attempt, a validation error, or any HTTP 400 the repair processors cannot fix — surface immediately instead of being replayed unchanged. Pass `StreamErrorRetryProcessor({ retryUnknownErrors: true })` in `errorProcessors` to retry unmatched errors. `createCodingAgent` keeps its shipped behavior, retrying both unmatched errors and bad-request responses, as it always has.

Error-processor retries are bounded by a safety cap of `3` per turn when you don't set `maxProcessorRetries`; the defaults stop well below it on their own. The "errorProcessors are configured without an explicit maxProcessorRetries" warning now fires only when you configured error processors yourself, not for the framework defaults.
