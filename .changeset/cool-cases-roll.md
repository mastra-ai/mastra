---
'@mastra/core': patch
---

Fix model router routing providers that use non-default AI SDK packages (e.g. `@ai-sdk/anthropic`, `@ai-sdk/openai`) to their correct SDK instead of falling back to `openai-compatible`. Add `cerebras`, `togetherai`, and `deepinfra` as native SDK providers.
