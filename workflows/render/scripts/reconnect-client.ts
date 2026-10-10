import { adapter, persistence, storage, workflow } from './fixture.js';
import { randomUUID } from 'node:crypto';

try {
  const [mode, runId] = process.argv.slice(2);
  if (mode === 'submit') {
    const run = await workflow.createRun({ resourceId: 'reconnect-owner' });
    const audit = randomUUID();
    const started = await run.startAsync({
      inputData: { value: 6, audit, fail: 'none', delayMs: 10000 },
      initialState: { prepared: false },
    });
    console.log(JSON.stringify({ ...started, audit, pid: process.pid }));
  } else if (mode === 'status' && runId) {
    console.log(
      JSON.stringify({
        record: await adapter.provider.getRun(workflow.id, runId),
        snapshot: await workflow.getWorkflowRunById(runId),
        pid: process.pid,
      }),
    );
  } else if (mode === 'cancel' && runId) {
    const run = await workflow.createRun({ runId, resourceId: 'reconnect-owner' });
    await run.cancel();
    console.log(JSON.stringify({ record: await adapter.provider.getRun(workflow.id, runId), pid: process.pid }));
  } else throw new Error('Expected submit, status RUN_ID, or cancel RUN_ID');
} finally {
  await persistence.close();
  await storage.close();
}
