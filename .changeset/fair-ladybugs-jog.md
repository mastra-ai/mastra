---
"@mastra/observability": patch
---

**Fixed Anthropic cache tokens being double-counted in observability metrics**

Anthropic cache token usage is now normalized correctly for AI SDK v6-style usage payloads, so input token metrics and tracing output no longer overcount cached tokens when the total already includes them.
