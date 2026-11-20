import { parseArgs } from 'node:util';
import { datasets } from '../src/examples/datasets.ts';
import { seedDataset } from '../src/mastra/knowledge/seed.ts';
import { WriterBusyError } from '../src/mastra/knowledge/writer-lock.ts';

try {
  const { values } = parseArgs({
    options: { dataset: { type: 'string' }, 'dry-run': { type: 'boolean' }, 'recover-lock': { type: 'boolean' } },
    allowPositionals: false,
  });
  const config = values.dataset && Object.hasOwn(datasets, values.dataset) ? datasets[values.dataset] : undefined;
  if (!config) throw new Error(`Choose --dataset ${Object.keys(datasets).join(' or ')}`);
  if (values['dry-run'] && values['recover-lock']) throw new Error('Lock recovery requires an apply run');
  console.log(
    JSON.stringify(
      await seedDataset(config, { dryRun: values['dry-run'], recoverStoppedOwner: values['recover-lock'] }),
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = error instanceof WriterBusyError ? 75 : 1;
}
