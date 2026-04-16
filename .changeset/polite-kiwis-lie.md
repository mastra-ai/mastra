---
'@mastra/core': patch
---

Fixed processOutputStep not receiving token usage data. Output processors now receive usage (inputTokens, outputTokens, totalTokens) for the current LLM step, enabling per-step cost tracking and token budget enforcement.
