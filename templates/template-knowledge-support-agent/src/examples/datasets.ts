import { examples } from './runtime.ts';
import type { DatasetConfiguration } from '../mastra/knowledge/seed-manifest.ts';

/** Dataset aliases remain available independently of the selected runtime use case. */
export const datasets: Record<string, DatasetConfiguration> = Object.fromEntries(
  Object.values(examples).flatMap(example => example.datasets.map(dataset => [dataset.id, dataset])),
);
