---
'@mastra/core': patch
---

Added a reactive `ProviderHistoryCompat` rule (`anthropic-strip-foreign-signed-reasoning`) that repairs a thread after one provider's signed `thinking` blocks are replayed to another and rejected (`Invalid \`signature\` in \`thinking\` block`, e.g. Kimi For Coding ↔ `anthropic/claude-sonnet-4-6`). It reads the per-turn `content.metadata.provider` stamp and strips the signature / redacted payload off persisted reasoning that came from a different provider, so the retried request succeeds and the thread stays fixed. It complements the preemptive `dropCrossProviderSignedReasoning` at the message-list seam and also recovers the trailing `tool_use` continuation shape that the seam cannot.
