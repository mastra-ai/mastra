import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { Render } from '@renderinc/sdk';
import { waitForCanceledTree } from './native-cancellation.js';
import { adapter, database, persistence, storage, workflow, retryWorkflow } from './native-fixture.js';

const client = new Render();
const modes = (
  process.env.NATIVE_TEST_MODES ?? 'success,child-retry,nested-failure,root-crash,root-timeout,cancel,agent'
).split(',');
const observations: unknown[] = [];
mkdirSync('.scratch', { recursive: true });
const output = process.env.NATIVE_RESULTS_FILE ?? '.scratch/native-observations.json';
/** Read only this fixture invocation's effects for lineage and duplicate-execution assertions. */
async function events(audit: string) {
  return (
    await database.query<{
      event: string;
      details: {
        logicalRunId?: string;
        native?: { taskRunId?: string; parentTaskRunId?: string; rootTaskRunId?: string };
      };
    }>('SELECT event, details FROM mastra_render_native_audit WHERE audit=$1 ORDER BY id', [audit])
  ).rows;
}
try {
  // Only test instrumentation tables, separate from adapter and Mastra persistence.
  await database.query(`CREATE TABLE IF NOT EXISTS mastra_render_native_audit (
    id bigserial PRIMARY KEY, audit text NOT NULL, event text NOT NULL, details jsonb NOT NULL
  )`);
  for (const mode of modes) {
    const selected = mode.startsWith('root-') ? retryWorkflow : workflow;
    const audit = randomUUID();
    const run = await selected.createRun({ resourceId: 'native-proof-user' });
    const startedAt = Date.now();
    console.log(JSON.stringify({ mode, runId: run.runId, audit, phase: 'submitting' }));
    await run.startAsync({
      inputData: { audit, mode, value: 1 } as Parameters<typeof run.startAsync>[0]['inputData'],
      initialState: { count: 0 },
    });
    if (mode === 'cancel') {
      const deadline = Date.now() + 120000;
      while (!(await events(audit)).some(event => event.event === 'leaf')) {
        assert.ok(Date.now() < deadline, 'Nested leaf did not start before cancellation deadline');
        await delay(1000);
      }
      await run.cancel();
    }
    const record = await adapter.provider.wait(selected.id, run.runId, AbortSignal.timeout(240000));
    const expected = mode === 'cancel' ? 'canceled' : mode === 'nested-failure' ? 'failed' : 'success';
    assert.equal(record.status, expected, JSON.stringify(record.error));
    const log = await events(audit);
    const root = await client.workflows.getTaskRun(record.providerId!);
    const readChain = async () =>
      (await client.workflows.listTaskRuns({ rootTaskRunId: [record.providerId!], limit: 100 }))
        .map(item => item.taskRun)
        .filter(item => item.rootTaskRunId === record.providerId);
    const chain = mode === 'cancel' ? await waitForCanceledTree(record.providerId!, readChain) : await readChain();
    const repeat = mode.startsWith('root-') ? 2 : 1;
    assert.equal(
      log.filter(event => event.event === 'prepare').length,
      repeat,
      'Completed preparation should repeat only on root restart',
    );
    assert.ok(log.filter(event => event.event === 'prepare').every(event => event.details.logicalRunId === run.runId));
    if (mode.startsWith('root-')) {
      assert.equal(root.attempts.length, 2);
      assert.notEqual(record.snapshotRunId, run.runId);
      assert.equal(log.filter(event => event.event === 'root-finished').length, 2);
    }
    if (!process.env.RENDER_USE_LOCAL_DEV) {
      assert.equal(record.rootProviderId, record.providerId);
      for (const event of log) {
        assert.ok(event.details.native?.taskRunId, 'Hosted native identity was not available');
        assert.equal(event.details.native.rootTaskRunId, record.providerId);
        if (event.event === 'leaf')
          assert.notEqual(event.details.native.parentTaskRunId, record.providerId, 'Leaf must be a native grandchild');
      }
    }
    if (expected === 'success') {
      assert.equal((record.result as { result: { value: number } }).result.value, 5);
      assert.equal(chain.length, repeat === 2 ? 9 : 5);
      assert.equal(log.filter(event => event.event === 'finish').length, repeat);
      assert.equal(log.filter(event => event.event === 'leaf').length, mode === 'child-retry' ? 2 : repeat);
      const snapshot = await selected.getWorkflowRunById(run.runId);
      assert.equal(snapshot?.status, 'success');
      assert.equal(snapshot?.runId, run.runId);
      assert.equal((snapshot?.result as { value: number })?.value, 5);
      if (mode === 'agent')
        assert.ok((record.result as { result: { agentText: string } }).result.agentText.length > 10);
    } else assert.equal(log.filter(event => event.event === 'finish').length, 0);
    const observation = {
      mode,
      passed: true,
      runId: run.runId,
      rootId: record.providerId,
      audit,
      status: record.status,
      rootAttempts: root.attempts.length,
      chain,
      events: log,
      elapsedMs: Date.now() - startedAt,
      ...(mode === 'agent' ? { model: process.env.NATIVE_TEST_MODEL, result: record.result } : {}),
    };
    observations.push(observation);
    writeFileSync(output, JSON.stringify(observations, null, 2));
    console.log(
      JSON.stringify({
        mode,
        passed: true,
        runId: run.runId,
        rootId: record.providerId,
        attempts: root.attempts.length,
      }),
    );
  }
} finally {
  await Promise.all([database.end(), persistence.close(), storage.close()]);
}
