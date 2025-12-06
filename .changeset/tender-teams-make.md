---
"@mastra/core": patch
---

Fix model fallback not triggering on mid-stream errors (like quota exceeded or rate limit)

Previously, when a model returned an error mid-stream (after the connection was established), the fallback mechanism would not trigger. This was because error chunks were being processed but not thrown, so the fallback logic in `executeStreamWithFallbackModels` never caught them.

This fix ensures that mid-stream errors are properly thrown from `processOutputStream`, allowing the fallback mechanism to catch them and try the next model in the chain. The error is only enqueued to the output stream when it's the last model in the fallback chain.

Fixes #9306
