---
'@mastra/core': patch
---

Run input processors (moderation, injection detection, PII filtering) on signals arriving mid-run. Previously, signals drained between loop iterations bypassed processInput guardrails. Now all signal delivery paths go through the same processor pipeline before reaching the LLM.
