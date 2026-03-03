---
'@mastra/core': patch
---

Fixed sub-agent instructions being overridden when the parent agent uses an OpenAI model. Previously, OpenAI models would fill in the optional `instructions` parameter when calling a sub-agent tool, completely replacing the sub-agent's own instructions. Now, any LLM-provided instructions are appended to the sub-agent's configured instructions instead of replacing them.
