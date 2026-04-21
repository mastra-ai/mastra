---
'@mastra/core': patch
---

Fixed PrefillErrorHandler to recover from Qwen/llama.cpp prefill rejections with enable_thinking, so agents retry with a continue reminder instead of failing after skill/tool turns.
