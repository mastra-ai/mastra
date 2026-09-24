---
'@mastra/editor': patch
---

Builder agents keep their stability error processors on every supported `@mastra/core` version, including cores that predate the framework defaults. Adding a processor never costs the builder its recovery:

```ts
createBuilderAgent({ errorProcessors: [myProcessor] });
// resolved: provider-history-compat, prefill-error-handler,
// stream-error-retry-processor, myProcessor
```

A caller's array merges with the builder's list. A caller instance with a default's `id` takes that default's slot. Other caller processors run after the defaults, in the framework's repair-first order. An explicit `errorProcessors: []` opts out. A function-valued override passes through unchanged, so a callback must return every processor it needs. `DEFAULT_BUILDER_ERROR_PROCESSORS` is still exported.
