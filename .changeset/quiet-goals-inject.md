---
'@mastra/core': patch
---

Add `jsonPromptInjection: 'auto'` to select native structured output when model capability data confirms support and inline JSON prompt injection otherwise. Goal judges use this shared automatic path while preserving fallback retries for unexpected provider failures.
