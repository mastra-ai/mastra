import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { datasets } from '../../examples/datasets.ts';
import { runtimeExample } from '../../examples/runtime.ts';
import { seedDataset } from './seed.ts';

export async function seedHostedExample() {
  const dataset = datasets[runtimeExample.initialDataset]!;
  await seedDataset({
    ...dataset,
    directory: fileURLToPath(new URL(`./.support-datasets/${basename(dataset.directory)}/`, import.meta.url)),
  });
}
