---
'@mastra/server': minor
---

Added optional `thinkingLevel` support to the controller switch-model endpoint so clients can persist the model and reasoning effort in one request.

```json
{ "modelId": "openai/gpt-5.5", "thinkingLevel": "high" }
```
