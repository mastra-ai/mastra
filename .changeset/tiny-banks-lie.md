---
'@mastra/memory': patch
'@mastra/core': patch
---

Improved token counting accuracy for Observational Memory. Each LLM step now appends a per-step usage entry (`stepTokenCounts[]`) to the assistant message metadata, recording `outputTokens`, `inputTokens`, `reasoningTokens`, and other provider-reported counts. When `inputTokens` are available, OM uses an input-token delta formula to accurately account for text, reasoning, tool-call arguments, and tool results. Falls back to summing `outputTokens` when `inputTokens` are unavailable, and to tiktoken estimation when no provider counts exist.
