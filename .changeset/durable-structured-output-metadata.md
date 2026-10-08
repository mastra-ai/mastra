---
'@mastra/core': patch
---

Fixed durable and evented agents not saving the structured output object to memory. The saved assistant message now includes `metadata.structuredOutput`, matching regular agents, so reconnecting clients and recovered runs can read the object. This does not yet apply when `structuredOutput.model` is set to a separate structuring model (see [#26431](https://github.com/mastra-ai/mastra/issues/26431)). Fixes [#26432](https://github.com/mastra-ai/mastra/issues/26432).
