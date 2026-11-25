---
'@mastra/code-sdk': minor
---

Added `resolveModelRoute` to `createMastraCode`. A host can now choose the model route for each request. The first model runs the request at its own thinking level, which wins over the session's. When it is rate-limited, out of credits, unauthorized, unavailable or not found, the request continues on the next model, each at its own thinking level. With a tenant credential store, later models the tenant has no key for are skipped. An empty list runs the session model at the session's thinking level, with no fallbacks. While the hook is set, its list replaces the session's model pack route and sticky fallback on every request.

```ts
const code = await createMastraCode({
  resolveModelRoute: async () => [
    { modelId: 'anthropic/claude-opus-5.5', thinkingLevel: 'medium' },
    { modelId: 'openai/gpt-5.6-sol', thinkingLevel: 'high' },
  ],
});
```

An error that does not switch models, such as a prompt that is too long, now ends the run with the provider's own error even when a fallback model is configured. Before, it ended with `Processor "mastracode-account-rotation" stopped the run: …`.

A rate-limited model with another model after it in the route now switches straight away. Before, the request first waited out the provider's `Retry-After` and retried the same model once. A request on a single model still makes that one retry.

Each model switch now records why it happened: rate limit, out of credits, missing or rejected credentials, provider unavailable, timeout, or a model the provider does not serve.

The `info` event sent on a model switch now names the cause first.

**Before:** `Switched model route: anthropic/claude-opus-5.5 → openai/gpt-5.6-sol (pool exhausted)`

**After:** `anthropic/claude-opus-5.5 is rate-limited, switched to openai/gpt-5.6-sol`

Fallback helpers now live in `@mastra/code-sdk/model-fallback`, so hosts and browser clients read and word model switches the same way. Importing them from `@mastra/code-sdk/auth/account-rotation-processor` or `@mastra/code-sdk/schema` still works but is deprecated. `isModelFallbackReason` is deprecated too; `parseModelFallbackPart` validates the whole record:

```diff
- import {
-   MODEL_FALLBACK_PART_TYPE,
-   MODEL_FALLBACK_STATE_KEY,
-   modelFallbackNoticeText,
-   isModelFallbackReason,
- } from '@mastra/code-sdk/auth/account-rotation-processor';
- import type { ModelFallbackPartData } from '@mastra/code-sdk/auth/account-rotation-processor';
- import type { PendingModelFallback } from '@mastra/code-sdk/schema';
+ import {
+   MODEL_FALLBACK_PART_TYPE,
+   MODEL_FALLBACK_STATE_KEY,
+   modelFallbackNoticeText,
+   parseModelFallbackPart,
+ } from '@mastra/code-sdk/model-fallback';
+ import type { ModelFallbackPartData, PendingModelFallback } from '@mastra/code-sdk/model-fallback';
```
