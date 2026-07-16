---
'@mastra/core': patch
---

Add `jsonPromptInjection: 'auto'` to select native structured output when model capability data confirms support and inline JSON prompt injection otherwise. Scorer judges use this automatic path by default while preserving explicit `jsonPromptInjection` overrides and fallback retries for unexpected provider failures.
