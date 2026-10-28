---
'@mastra/core': patch
---

Durable and evented agents now fill in a generated response id and timestamp when the model provider doesn't send one (e.g. Gemini). Before, `response.id` was empty and step-finish metadata had no id or timestamp, while regular agents already filled both. When the provider does send a response id, that id is still used.
