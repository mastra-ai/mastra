import { MockStore } from '../../../storage/mock';
import { RunJournal } from '../../run-journal';
import type { StepResult, WorkflowRunState } from '../../types';

const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
if (!gc) throw new Error('GC is not exposed');

// The in-memory store clones what it's given, so only the journal could hold the written result.
const journal = new RunJournal({ store: new MockStore().stores.workflows, workflowName: 'wf', runId: 'r' });
const stepResults: Record<string, StepResult<any, any, any, any>> = {};

let collected = false;
const finalizer = new FinalizationRegistry(() => {
  collected = true;
});

async function writeThenEvict() {
  const result = { status: 'success', output: { text: 'x'.repeat(100_000) }, payload: {}, startedAt: 1, endedAt: 2 };
  stepResults.step = result as StepResult<any, any, any, any>;
  const snapshot = { runId: 'r', status: 'running', value: {}, context: stepResults } as unknown as WorkflowRunState;
  await journal.write({ snapshot });
  journal.evict(stepResults, []);
  finalizer.register(result, undefined);
}

await writeThenEvict();

for (let attempt = 0; attempt < 100 && !collected; attempt++) {
  gc();
  await new Promise<void>(resolve => setImmediate(resolve));
}

if (!collected) throw new Error('The evicted step result was not garbage collected');
// Keep the journal reachable until the check, so it's the journal that let the result go.
if (!journal) throw new Error('unreachable');
process.send?.('ok');
