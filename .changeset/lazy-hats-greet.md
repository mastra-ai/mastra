---
'@mastra/code-sdk': minor
---

Added `resolveModelFallbacks` to `createMastraCode`. A host can now supply fallback model IDs per request. When the session model is rate-limited, out of credits, unauthorized or unavailable, the request continues on the next fallback. A tenant credential store, which disallows environment keys, skips the fallbacks it holds no key for. The next request starts on the session model again. While the hook is set, its list replaces the session's model pack route and sticky fallback on every request, even when it returns an empty list.

```ts
const code = await createMastraCode({
  resolveModelFallbacks: async ({ requestContext }) => ['openai/gpt-5.6-sol'],
});
```

An error that does not switch models, such as a prompt that is too long, now ends the run with the provider's own error even when a fallback model is configured. Before, it ended with `Processor "mastracode-account-rotation" stopped the run: …`.

Each model switch now records why it happened (rate limit, out of credits, missing or rejected credentials, provider unavailable or timeout), along with the provider's retry time when it sends one. The new `@mastra/code-sdk/model-fallback` module holds every fallback contract, so hosts and browser clients render switches the same way: the part type, the notice text (`modelFallbackNoticeText`, with an optional formatter for model display names), `parseModelFallbackPart` for saved switch records, `MODEL_FALLBACK_STATE_KEY` and `parsePendingModelFallback` for the pending switch in session state and thread settings, `pendingModelFallbackForThread` to read that switch for one thread, `fallbackModelIdsToTry` for the fallbacks a request will actually try, and `modelRouteFailureFromError` to turn a provider error into its recorded cause.

The `info` event sent on a model switch now names the cause first.

**Before:** `Switched model route: anthropic/claude-opus-5.5 → openai/gpt-5.6-sol (pool exhausted)`

**After:** `anthropic/claude-opus-5.5 is rate-limited, switched to openai/gpt-5.6-sol`

The fallback exports moved out of `@mastra/code-sdk/auth/account-rotation-processor` and `@mastra/code-sdk/schema`. `isModelFallbackReason` was removed; `parseModelFallbackPart` validates the whole record:

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
