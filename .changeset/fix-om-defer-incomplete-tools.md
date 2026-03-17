---
'@mastra/memory': patch
---

Fixed observational memory triggering observation while provider-executed tool calls are still pending (`state: 'call'`). OM now defers async buffering and threshold-reached observation until tool results arrive, preventing split messages that caused Anthropic 400 errors on follow-up turns.
