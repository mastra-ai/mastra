---
'@mastra/core': minor
'@mastra/memory': minor
'@mastra/server': minor
---

Support token-based conversation history with `lastMessages: { maxTokens, atMaxRemoveTokens?, maxMessages? }`. Memory uses the existing `TokenLimiterProcessor` in `memory-only` mode, sharing Observational Memory's token estimator and dropping older history in chunks without removing current input, responses, context, or system messages. Persisted thread boundaries keep trimmed history out of subsequent turns without deleting stored messages. Server configuration schemas and recall pagination accept the nested options.
