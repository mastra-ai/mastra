---
'@mastra/platform': minor
---

Added Mastra Gateway management to `MastraPlatform` and `MastraProject`. `project.gateway` creates, updates and revokes the project's Gateway API keys, reports what a key with a spend limit has spent, lists the models keys can call, and totals the project's Gateway usage.

```ts
const { keyId, apiKey } = await project.gateway.createKey({
  label: 'support-backend',
  allowedModels: ['openai/gpt-5-mini'],
  spendLimit: { limitUsd: '50', reset: { every: 1, unit: 'month' } },
});

const { remainingUsd } = await project.gateway.keyBudget(keyId);
const byModel = await project.gateway.usage({ from: '2026-11-01', to: '2026-11-30', groupBy: 'model' });
```
