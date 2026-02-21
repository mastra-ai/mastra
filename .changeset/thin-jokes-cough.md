---
'@mastra/memory': patch
---

Added safety guards against degenerate LLM output in observational memory. Individual observation lines are now capped at 10,000 characters to prevent runaway output from inflating token counts. Repetitive output patterns (e.g., Gemini Flash repeat-penalty loops) are automatically detected and the observation is retried once before discarding. This prevents inflated observation token counts that could previously cause excessive context usage after activation.
