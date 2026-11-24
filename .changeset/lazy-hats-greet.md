---
'@mastra/code-sdk': minor
---

Added `resolveModelFallbacks` to `createMastraCode`. A host can now supply fallback model IDs per request. When the session model is rate-limited, out of credits, unauthorized or unavailable, the request continues on the next fallback. With a tenant credential store, fallbacks the tenant has no key for are skipped. When the provider sends a retry time, the following requests start on the fallback until then and try the session model last. Without one, the next request starts on the session model again. While the hook is set, its list replaces the session's model pack route on every request, even when it returns an empty list.

```ts
const code = await createMastraCode({
  resolveModelFallbacks: async () => ['openai/gpt-5.6-sol'],
});
```

An error that does not switch models, such as a prompt that is too long, now ends the run with the provider's own error even when a fallback model is configured. Before, it ended with `Processor "mastracode-account-rotation" stopped the run: …`.

Each model switch now records why it happened (rate limit, out of credits, missing or rejected credentials, provider unavailable or timeout), along with the provider's retry time when it sends one.

The `info` event sent on a model switch now names the cause first, and how long the provider asks to wait when it says.

**Before:** `Switched model route: anthropic/claude-opus-5.5 → openai/gpt-5.6-sol (pool exhausted)`

**After:** `anthropic/claude-opus-5.5 is rate-limited for 5 min, switched to openai/gpt-5.6-sol`

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
