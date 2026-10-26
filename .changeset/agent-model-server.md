---
'@mastra/server': minor
---

Added an `agentModel` field to `POST /datasets/:datasetId/experiments`, for example `{ "agentModel": { "provider": "anthropic", "modelId": "claude-haiku-5-5" } }`, to run an agent experiment against a different model. The request is rejected when `targetType` is not `"agent"` or when `start` is `false`.
