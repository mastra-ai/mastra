---
'@mastra/memory': patch
---

Fixed "Expression produces a union type that is too complex to represent" type errors in observational memory when the model list grows. Observer, reflector and fallback model lists no longer make type checking scale with the number of model IDs.
