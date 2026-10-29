---
'@mastra/core': patch
---

Fixed Claude 5.x thinking blocks being stripped from earlier assistant messages on every request, which changed the prompt prefix each step and broke Anthropic prompt caching. The `anthropic-strip-empty-signed-reasoning-content` rule in `ProviderHistoryCompat` now runs only after Anthropic rejects the history with the "thinking blocks cannot be modified" error, so valid empty-text signed blocks are replayed unchanged.
