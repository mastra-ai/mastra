---
'@mastra/core': minor
---

Added a `model` option to experiments so the same dataset (including its tool mocks) can be run against one agent with different models.

The registered agent is never mutated: the experiment runs a forked copy with the same id, so `targetId`, traces and scores keep pointing at the same agent. `model` only works with `targetType: 'agent'`; combining it with `task`, `workflow` or `scorer` targets fails at setup. Use `grouping.comparisonId` / `grouping.variantId` to tell the runs apart.

```ts
const dataset = await mastra.datasets.get({ id: datasetId });

for (const model of ['openai/gpt-4o', 'anthropic/claude-sonnet-4-5']) {
  await dataset.startExperiment({
    targetType: 'agent',
    targetId: 'support-agent',
    model,
    grouping: { comparisonId: 'model-bakeoff', variantId: model },
    scorers: ['answer-relevancy'],
  });
}

const runs = await dataset.listExperiments({ comparisonId: 'model-bakeoff' });
```
