---
'@mastra/core': patch
---

Fixed provider-executed tool errors being saved as successful results. When a provider tool (for example Anthropic tool search) returns a result flagged `isError`, Mastra now stores it as an error and sends the original error object back to the model as `error-json`. Before this fix it was sent back as `json`, and with Anthropic tool search that failed every later step and broke the thread.
