import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Render } from '@renderinc/sdk';
import { adapter, persistence, storage, whileWorkflow, untilWorkflow } from './fixture.js';

const client = new Render({
  useLocalDev: true,
  localDevUrl: process.env.RENDER_LOCAL_DEV_URL ?? 'http://127.0.0.1:8138',
});
const observations: unknown[] = [];
const events = (audit: string) =>
  readFileSync(`.scratch/audit/${audit}.jsonl`, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as { event: string; pid: number });

try {
  for (const workflow of [whileWorkflow, untilWorkflow]) {
    for (const fail of ['none', 'once', 'always'] as const) {
      const audit = randomUUID();
      const run = await workflow.createRun({ resourceId: 'local-loop-test' });
      const result = await run.start({
        inputData: { audit, round: 0, fail, pids: [], delayMs: 50 },
        initialState: { rounds: 0 },
      });
      const record = await adapter.provider.getRun(workflow.id, run.runId);
      const observed = events(audit);
      const counts = [1, 2, 3].map(round => observed.filter(item => item.event === `round-${round}`).length);
      assert.equal(result.status, fail === 'always' ? 'failed' : 'success');
      assert.equal(record?.status, result.status);
      assert.deepEqual(counts, [1, fail === 'none' ? 1 : 2, fail === 'always' ? 0 : 1]);
      if (result.status === 'success') {
        assert.equal(result.result.round, 3);
        assert.equal(new Set(result.result.pids).size, 3);
      }
      const chain = (await client.workflows.listTaskRuns({ rootTaskRunId: [record!.providerId!], limit: 100 }))
        .map(item => item.taskRun)
        .filter(task => task.rootTaskRunId === record!.providerId);
      const children = chain.filter(task => task.id !== record!.providerId);
      assert.equal(children.length, fail === 'always' ? 2 : 3);
      assert.ok(children.every(task => task.parentTaskRunId === record!.providerId));
      // The local CLI reports retries: 0 even after a retry; use its actual attempt records.
      const details = await Promise.all(children.map(task => client.workflows.getTaskRun(task.id)));
      assert.equal(
        details.reduce((sum, task) => sum + task.attempts.length - 1, 0),
        fail === 'none' ? 0 : 1,
      );
      assert.equal((await client.workflows.getTaskRun(record!.providerId!)).attempts.length, 1);
      observations.push({
        workflow: workflow.id,
        fail,
        result,
        counts,
        chain,
        details,
        providerId: record?.providerId,
      });
      console.log(`PASS: ${workflow.id} ${fail}`);
    }
  }

  const audit = randomUUID();
  const run = await untilWorkflow.createRun();
  await run.startAsync({
    inputData: { audit, round: 0, fail: 'none', pids: [], delayMs: 5000 },
    initialState: { rounds: 0 },
  });
  const deadline = Date.now() + 30000;
  let started = false;
  while (Date.now() < deadline) {
    try {
      started = events(audit).length > 0;
    } catch {}
    if (started) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(started, 'first loop iteration did not start');
  await run.cancel();
  const canceled = await adapter.provider.wait(untilWorkflow.id, run.runId);
  assert.equal(canceled.status, 'canceled');
  await new Promise(resolve => setTimeout(resolve, 5500));
  assert.deepEqual(
    events(audit).map(item => item.event),
    ['round-1'],
  );
  observations.push({ workflow: untilWorkflow.id, cancellation: true, providerId: canceled.providerId });
  console.log('PASS: cancel stops subsequent loop iterations');
  writeFileSync('.scratch/loop-observations.json', JSON.stringify(observations, null, 2));
} finally {
  await persistence.close();
  await storage.close();
}
