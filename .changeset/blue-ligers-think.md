---
'@mastra/core': minor
---

Added `processLLMRequest`, a processor hook that runs after messages are converted to the provider-facing prompt and before the model request is sent. The hook lets processors make temporary, model-aware prompt changes without mutating stored message history, memory, UI history, or later provider calls.

`ProviderHistoryCompat` now uses this hook to prevent reasoning-history incompatibilities when switching providers. It strips reasoning parts from Cerebras-bound prompts that would otherwise be sent as rejected `reasoning_content`, and strips non-Anthropic reasoning from Anthropic-bound prompts while preserving Anthropic-native thinking blocks.
