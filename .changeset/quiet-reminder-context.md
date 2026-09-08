---
'@mastra/memory': patch
---

Improve passive Subconscious reminder context by supplying accumulated parent-visible active observations and observed message parts without the additional 500-character cap. Preserve the existing `DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS` tool-result budget of 10,000 tokens. Clarify that passive reminders should omit facts already present in the supplied parent context, even when another conversation provides the same fact. This remains model-based suppression, not guaranteed semantic deduplication; larger text inputs can increase token usage.
