---
'@mastra/core': patch
---

Fixed client tools and AI SDK `jsonSchema()` tools losing unions (`anyOf`) in their input schema. The model was offered an empty object instead of every branch, so it could only send empty arguments, and any value passed validation. Union schemas now reach the model intact and arguments are validated against them.
