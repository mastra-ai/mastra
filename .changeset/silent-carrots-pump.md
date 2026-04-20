---
'@mastra/core': patch
---

Fixed `onStepFinish` and `onFinish` callbacks so their `usage` object now includes the `raw` provider-level token breakdown that was being dropped by the internal usage accumulator.

**Why:** The `LanguageModelUsage` type declares a `raw?: unknown` field (added with V3 support in #11191) that preserves the provider's original usage object — useful for inspecting cache metrics like `cacheRead`, `cacheWrite`, `noCache` when verifying prompt caching with Anthropic or Bedrock. Although `normalizeUsage()` already populated `raw`, `MastraModelOutput` stripped it while rebuilding the usage object, so it never reached `onStepFinish`/`onFinish`. This restores the documented contract without requiring `wrapStream` middleware.

**Example:**

```ts
const result = await agent.stream('hi', {
  onStepFinish: step => {
    // before: step.usage.raw was undefined
    // after:  step.usage.raw is the provider's original usage object
    console.log(step.usage.raw);
  },
});
```

Closes #15510.
