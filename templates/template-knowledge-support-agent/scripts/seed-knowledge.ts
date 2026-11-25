import { parseArgs } from 'node:util';
import { datasets } from '../src/examples/datasets.ts';
import { runtimeExample } from '../src/examples/runtime.ts';
import { seedDataset } from '../src/mastra/knowledge/seed.ts';
import { WriterBusyError } from '../src/mastra/knowledge/writer-lock.ts';
import { replaceApprovedPolicyRevisions } from '../src/mastra/knowledge/required-policy.ts';

try {
  const { values } = parseArgs({
    options: {
      dataset: { type: 'string' },
      'dry-run': { type: 'boolean' },
      'recover-lock': { type: 'boolean' },
      'replace-policy-approvals': { type: 'string' },
    },
    allowPositionals: false,
  });
  const approvalSource = values['replace-policy-approvals'];
  if (approvalSource !== undefined) {
    if (!approvalSource || values.dataset || values['dry-run'] || values['recover-lock'])
      throw new Error('Use --replace-policy-approvals with one input file and no other flags');
    await replaceApprovedPolicyRevisions(approvalSource);
    console.log('Updated policy approvals.');
  } else {
    const dataset = values.dataset ?? runtimeExample.initialDataset;
    const config = Object.hasOwn(datasets, dataset) ? datasets[dataset] : undefined;
    if (!config) throw new Error(`Choose --dataset ${Object.keys(datasets).join(' or ')}`);
    if (values['dry-run'] && values['recover-lock']) throw new Error('Lock recovery requires an apply run');
    // Accept the legacy recovery flag. Writers now recover automatically.
    console.log(JSON.stringify(await seedDataset(config, { dryRun: values['dry-run'] }), null, 2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = error instanceof WriterBusyError ? 75 : 1;
}
