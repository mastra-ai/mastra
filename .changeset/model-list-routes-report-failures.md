---
'@mastra/server': patch
---

The agent model list reorder and update routes now return an error (400 or 404) instead of a success response when the edit cannot be applied, and resolve function-valued model lists with the request's context.
