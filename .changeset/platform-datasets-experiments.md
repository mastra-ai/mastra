---
'@mastra/platform': minor
---

Added `project.datasets` to `MastraProject`, for a Platform project's datasets and experiments. It has the same methods as `mastra.datasets`, and its datasets have the same methods as core's `Dataset`, so code written for `mastra.datasets` works with `{ datasets: project.datasets }`.

Run experiments from your own code and save them to the project: create an experiment, submit each item's result with its scores, and finalize it. The results show in Studio, and `compareExperiments` puts experiments of one dataset side by side, item by item.

```ts
import { MastraProject } from '@mastra/platform';

const project = new MastraProject({ accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN });
const dataset = await project.datasets.get({ id: 'ds_123' });

const { version } = await dataset.getDetails();
const { experimentId } = await dataset.createExperiment({ name: 'baseline', version });
for (const item of await dataset.listItems({ version })) {
  const output = await answer(item.input);
  await dataset.submitExperimentResult({
    experimentId,
    itemId: item.id,
    output,
    scores: [{ scorerId: 'accuracy', score: output === item.groundTruth ? 1 : 0 }],
    completedAt: new Date(),
  });
}
await dataset.finalizeExperiment({ experimentId });

const { items } = await project.datasets.compareExperiments({ experimentIds: [experimentId, previousExperimentId] });
```

`startExperiment` isn't supported yet. It, and other options the Platform can't honor such as a caller-chosen dataset `id`, throw a `MastraPlatformError` instead of being ignored.
