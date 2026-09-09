---
'@mastra/server': minor
---

Added a `model` field to the `POST /datasets/:datasetId/experiments` body to run an experiment against an agent with an overridden model. Accepts a router id string (e.g. `"openai/gpt-5"`) or a provider config object (`{ id, url?, apiKey?, headers? }`). Only valid for agent targets and requires `start: true`; the request is rejected with `400` otherwise. The registered agent is not mutated.

```ts
await fetch(`/api/datasets/${datasetId}/experiments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    targetType: 'agent',
    targetId: 'weather-agent',
    model: 'anthropic/claude-sonnet-4-6',
    grouping: { comparisonId: 'model-comparison', variantId: 'sonnet' },
  }),
});
```
