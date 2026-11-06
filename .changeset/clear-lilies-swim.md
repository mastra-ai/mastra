---
'@mastra/core': patch
---

Fixed client tools and AI SDK `jsonSchema()` tools losing unions (`anyOf`) in their input schema. The model was offered an empty object instead of every branch, so it could only send empty arguments. Union schemas now reach the model intact.

Tools with a plain JSON Schema input (including client tools sent by `@mastra/client-js`) now validate the model's arguments against that schema. Previously any arguments were accepted; arguments that don't match the schema now return a validation error to the model instead of reaching the tool. AI SDK `jsonSchema()` tools are still validated only by their own `validate` function, if they provide one.
