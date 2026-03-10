---
'@mastra/core': patch
---

Reasoning content from OpenAI models is now stripped from conversation history before replaying it to the LLM, preventing API errors on follow-up messages while preserving reasoning data in the database. Fixes #12980.
