---
'@mastra/core': patch
---

Fixed Gemini API errors caused by empty reasoning messages in conversation history. Empty reasoning parts with no metadata or Google-only metadata (thoughtSignature) are now filtered out before being sent to the LLM, preventing the "must include at least one parts field" error that poisoned entire conversation threads. All reasoning data is still stored in the database as-is, preserving it for when the upstream Google provider bug is fixed. Empty reasoning with non-Google metadata (OpenAI itemId, Anthropic signature/redactedData) is correctly sent to providers that require it. Fixes #12980.
