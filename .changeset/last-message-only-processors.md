---
'@mastra/core': patch
---

Added a `lastMessageOnly` option to the LLM-backed moderation, language detection, prompt injection, PII, and system prompt scrubber processors so they can inspect only the newest message instead of re-checking the full conversation on every run.
