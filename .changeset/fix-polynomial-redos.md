---
"@mastra/arthur": patch
"@mastra/laminar": patch
"@mastra/langfuse": patch
"@mastra/core": patch
"@mastra/memory": patch
"@mastra/rag": patch
"mastracode": patch
---

Fixed a security issue where several parsing and tracing paths could slow down on malformed or attacker-crafted input. Normal behavior is unchanged, and these packages now handle pathological input in linear time.
