---
'@mastra/core': patch
---

Fixed JSON parsing in agent network to handle malformed LLM output. Uses parsePartialJson from AI SDK to recover truncated JSON, missing braces, and unescaped control characters instead of failing immediately. This reduces unnecessary retry round-trips when the routing agent generates slightly malformed JSON for tool/workflow prompts. Fixes #12519.
