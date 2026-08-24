---
'@mastra/core': patch
---

Fixed Anthropic 400 errors ("thinking or redacted_thinking blocks in the latest assistant message cannot be modified") during tool-use turns with extended thinking. ProviderHistoryCompat no longer strips reasoning parts from the trailing assistant message of an active tool-use continuation, which Anthropic requires to be replayed exactly as it was generated. Historical assistant messages are still sanitized.
