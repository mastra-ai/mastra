---
'@mastra/core': patch
---

Fixed LLM-based output processors to buffer streamed text before moderation or system prompt detection, avoiding a model request for every token.
