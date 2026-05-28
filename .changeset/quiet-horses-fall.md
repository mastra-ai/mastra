---
'@mastra/memory': patch
'@mastra/core': patch
---

Moved Anthropic-specific compatibility code (tool-result input enrichment and orphaned tool-pair sanitization) from the core output converter to the ProviderHistoryCompat processor. These transformations now run only for Anthropic models via scoped compat rules instead of being applied unconditionally to all providers.
