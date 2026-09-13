---
'@mastra/core': patch
---

`ProviderHistoryCompat` now handles signed thinking blocks that cross providers. The new `anthropic-strip-foreign-signed-reasoning` rule drops signed reasoning from the outbound prompt when the turn that produced it was stamped with a different provider (for example Kimi For Coding ↔ `anthropic/claude-sonnet-4-6`), and reactively strips the signature off a persisted turn if a provider still rejects it with `Invalid \`signature\` in \`thinking\` block`, so the retry succeeds. To support provenance-aware rules, `processLLMRequest` args now expose the `messageList` the prompt was built from.
