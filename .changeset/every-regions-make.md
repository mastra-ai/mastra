---
'@mastra/core': patch
---

Fixed tool validation errors being passed to `toModelOutput`. When a tool that defines `toModelOutput` fails input, request context or output validation, the agent now skips `toModelOutput` and sends the validation error to the model unchanged, marked as an error result, so the model can see what went wrong and retry. Before, a mapper written for successful output turned the error into an empty result such as `{}`. This matches the `toModelOutput` type, which only receives the tool's output. Fixes #30211.
