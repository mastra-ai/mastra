import { invoiceFixtures, runFixture } from './support.ts';

for (const fixture of invoiceFixtures) {
  const run = await runFixture(fixture);
  console.log(`${fixture.document.id}: ${run.suspended ? 'suspended/resumed' : 'straight-through'} (${run.runId})`);
}
