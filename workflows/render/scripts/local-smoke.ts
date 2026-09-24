import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { adapter, persistence, storage, workflow } from './fixture.js';
import { Render } from '@renderinc/sdk';

const client = new Render({
  useLocalDev: true,
  localDevUrl: process.env.RENDER_LOCAL_DEV_URL ?? 'http://127.0.0.1:8138',
});

const observations: unknown[] = [];
try {
  for (const fail of ['none', 'once', 'always'] as const) {
    const audit = randomUUID();
    const run = await workflow.createRun({ resourceId: 'local-test-user' });
    const result = await run.start({
      inputData: { value: 6, audit, fail, delayMs: 300 },
      initialState: { prepared: false },
    });
    const record = await adapter.provider.getRun(workflow.id, run.runId);
    const events = readFileSync(`.scratch/audit/${audit}.jsonl`, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as { event: string; pid: number });
    const counts = Object.fromEntries(
      ['prepare', 'double', 'triple', 'finish'].map(key => [key, events.filter(event => event.event === key).length]),
    );
    if (fail === 'always') {
      assert.equal(result.status, 'failed');
      assert.equal(record?.status, 'failed');
    } else {
      assert.equal(result.status, 'success');
      if (result.status === 'success') {
        assert.equal(result.result.value, 35);
        assert.equal(result.result.prepared, true);
        assert.equal(result.result.locale, 'fr');
        assert.equal(result.result.original, 6);
        assert.equal(result.result.prior, 7);
        assert.equal(new Set(result.result.pids).size, 4);
        if (fail === 'none') assert.equal(result.result.overlap, true);
      }
      assert.equal(counts.prepare, 1);
      assert.equal(counts.triple, 1);
      assert.equal(counts.double, fail === 'once' ? 2 : 1);
      assert.equal(events.filter(event => event.event === 'native').length, 1);
    }
    // The local CLI currently returns other roots despite the filter. Scope evidence explicitly.
    const chain = (await client.workflows.listTaskRuns({ rootTaskRunId: [record!.providerId!], limit: 100 }))
      .map(item => item.taskRun)
      .filter(task => task.rootTaskRunId === record!.providerId);
    if (fail !== 'always') {
      assert.equal(chain.length, 6);
      assert.equal(chain.filter(task => task.parentTaskRunId && task.parentTaskRunId !== record!.providerId).length, 1);
    }
    observations.push({ fail, result, counts, chain, providerId: record?.providerId, runId: run.runId });
    console.log(`PASS: distributed ${fail} ${run.runId}`);
  }
  writeFileSync('.scratch/local-observations.json', JSON.stringify(observations, null, 2));
} finally {
  await persistence.close();
  await storage.close();
}
