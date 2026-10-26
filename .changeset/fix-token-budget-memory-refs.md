---
'@mastra/core': patch
---

Keep recalled messages as memory references in durable-agent checkpoints when `messageHistory.maxTokens` is set. Token counting adds framework-owned estimate caches to messages in memory; exclude only those cache entries from the saved-message identity comparison while retaining stored message content and caller-supplied metadata.
