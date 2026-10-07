---
'@mastra/factory': minor
---

Added `reasoningOptions` to each model returned by `GET /web/config/models`, so the Factory UI can offer only the thinking levels a model runs.

```json
{
  "models": [
    {
      "id": "openai/gpt-5",
      "provider": "openai",
      "modelName": "gpt-5",
      "hasApiKey": true,
      "reasoningOptions": [{ "type": "effort", "values": ["minimal", "low", "medium", "high"] }]
    }
  ]
}
```
