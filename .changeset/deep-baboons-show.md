---
'@mastra/factory': minor
---

Added `reasoningOptions` to the models `GET /web/config/models` returns when models.dev describes them, so the Factory UI can offer only the thinking levels a model runs. An empty list means models.dev lists the model without reasoning controls.

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
