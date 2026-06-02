---
'@mastra/editor': patch
'mastra': patch
---

Builder reliability: default error processors and strict instructions cap

- The agent builder now ships with three error processors enabled by default — `StreamErrorRetryProcessor` (transparent retries for transient OpenAI errors like `server_error`, `rate_limit`, `overloaded`), `PrefillErrorHandler` (recovers from Anthropic 400 prefill rejections), and `ProviderHistoryCompat` (per-provider history-shape fixes). Callers can still pass their own `errorProcessors` to `createBuilderAgent`; user-provided processors are appended after the defaults, so you can extend the defaults without losing them, or fully override them by passing a function.
- The `set-agent-instructions` tool now rejects over-limit drafts (>4,000 chars) instead of silently clipping. A rejected call returns `{ success: false, rejected: true, currentLength, limit }` and a message telling the LLM to drop a whole section and re-submit. Nothing is persisted on a rejected call, so the previously-persisted instructions stay intact. The snapshot directive walks the LLM through a count-before-calling drafting protocol that mirrors the new tool contract.
