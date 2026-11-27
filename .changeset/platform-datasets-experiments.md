---
'@mastra/platform': minor
---

Added `project.datasets` to `MastraProject`, for a Platform project's datasets and experiments. It has the same methods as `mastra.datasets`, and its datasets have the same methods as core's `Dataset`, so code written for `mastra.datasets` works with `{ datasets: project.datasets }`.

`startExperiment` runs the experiment in your process and uploads each result, with its scores, to the project as it finishes. The results show in Studio.

```ts
import { MastraProject } from '@mastra/platform';

const project = new MastraProject({ accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN });

const dataset = await project.datasets.create({ name: 'Billing questions' });
await dataset.addItems({ items: [{ input: 'Where is my invoice?', groundTruth: 'Billing > Invoices' }] });

const summary = await dataset.startExperiment({
  mastra,
  targetType: 'agent',
  targetId: 'support',
  scorers: [answerMatches],
});
```

To run items yourself, use `createExperiment`, `submitExperimentResult`, and `finalizeExperiment`. Options the Platform can't honor, such as a caller-chosen dataset `id`, throw instead of being ignored.
