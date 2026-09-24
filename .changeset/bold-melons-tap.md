---
'@mastra/core': minor
---

Default agents now recover from transient provider failures, assistant-prefill rejections, and provider history incompatibilities without extra configuration. A processor you supply with the same id is used instead of the matching default. Each added default is placed at the position its id gives it, so naming only one of the three still resolves them in the order that makes each repair run before the failures it prevents, and your own processors are never reordered relative to each other. Pass `errorProcessors: []` to run with no error processors at all, or set `errorProcessorDefaults: false` to run only the processors you configure with none of the defaults merged in.

The default retry processor does not retry unmatched errors. Transient failures carry provider `isRetryable` metadata or match the built-in matchers, so they still recover, but a deterministic failure — a rejected structured-output attempt, an invalid request, a validation error — is no longer replayed twice with a 3s delay. Pass `StreamErrorRetryProcessor({ retryUnknownErrors: true })` in `errorProcessors` to opt in. `createCodingAgent` keeps retrying unmatched errors, as it always has.

Error-phase processors now also run in the LLM request lane, so a `ProviderHistoryCompat` placed in `errorProcessors` applies its preemptive prompt rules as well as its reactive API-error recovery. A processor that joins that lane is traced there, which adds one `processor_run` span per model step for the processors that implement `processLLMRequest`.

Because the resolved error-processor list is now non-empty for every agent, the implicit `maxProcessorRetries` safety cap of `3` applies to bare agents too — the defaults self-limit well below it, so behavior is unchanged unless a processor never stops asking to retry. The "errorProcessors are configured without an explicit maxProcessorRetries" warning now fires only when you configured error processors yourself, not for the framework defaults.
