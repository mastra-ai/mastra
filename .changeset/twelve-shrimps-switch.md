---
'@mastra/core': patch
---

Added ProviderHistoryCompat error processor that automatically sanitizes tool-call IDs when switching between LLM providers. When a provider rejects tool IDs from another provider's history (e.g. Anthropic enforces `^[a-zA-Z0-9_-]+$`), the processor rewrites invalid characters and retries the request.
