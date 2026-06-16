---
"@mastra/memory": patch
---

Avoid observational memory provider-change activation when the same model is attributed through provider subnamespaces such as `openai` and `openai.responses`.
