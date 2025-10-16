---
'@mastra/core': patch
---

fix(core): Parse structured output from text field when object is undefined

Fixes agent network routing errors for models that return structured output in the text field but leave the object field undefined. Also handles models using `jsonPromptInjection` that wrap JSON responses in special tokens.
