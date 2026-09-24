import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { Render } from '@renderinc/sdk';

const exec = promisify(execFile);
const client = new Render({
  useLocalDev: true,
  localDevUrl: process.env.RENDER_LOCAL_DEV_URL ?? 'http://127.0.0.1:8138',
});
async function call(...args: string[]) {
  const { stdout } = await exec(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/reconnect-client.ts', ...args],
    { cwd: process.cwd(), env: process.env },
  );
  return JSON.parse(stdout.trim().split('\n').at(-1)!);
}
async function until<T>(operation: () => Promise<T>, check: (value: T) => boolean): Promise<T> {
  const deadline = performance.now() + 45000;
  while (performance.now() < deadline) {
    const value = await operation();
    if (check(value)) return value;
    await delay(250);
  }
  throw new Error('Lifecycle check timed out');
}
const evidence: unknown[] = [];
for (const mode of ['reconnect', 'cancel', 'root-loss']) {
  const submitted = await call('submit');
  const active = await until(
    () => call('status', submitted.runId),
    status => status.record?.workerClaim && status.record.status === 'running',
  );
  assert.notEqual(active.pid, submitted.pid);
  assert.equal(active.record.resourceId, 'reconnect-owner');
  if (mode === 'cancel') {
    await until(
      async () =>
        (await client.workflows.listTaskRuns({ rootTaskRunId: [active.record.providerId], limit: 100 }))
          .map(row => row.taskRun)
          .filter(task => task.rootTaskRunId === active.record.providerId),
      tasks => tasks.some(task => task.id !== active.record.providerId && task.status === 'running'),
    );
    await call('cancel', submitted.runId);
    const ended = await until(
      () => call('status', submitted.runId),
      status => status.record.status === 'canceled',
    );
    assert.equal(ended.snapshot.status, 'canceled');
    const descendants = (await client.workflows.listTaskRuns({ rootTaskRunId: [active.record.providerId], limit: 100 }))
      .filter(row => row.taskRun.rootTaskRunId === active.record.providerId)
      .map(row => ({ id: row.taskRun.id, status: row.taskRun.status }));
    assert(descendants.every(task => !['pending', 'running'].includes(task.status)));
    evidence.push({ mode, submitted, ended, descendants });
  } else if (mode === 'root-loss') {
    const rows = await until(
      async () => {
        try {
          return readFileSync(`.scratch/audit/${submitted.audit}.jsonl`, 'utf8')
            .trim()
            .split('\n')
            .map(row => JSON.parse(row));
        } catch {
          return [];
        }
      },
      rows => rows.some(row => row.event === 'root'),
    );
    const root = rows.find(row => row.event === 'root');
    // This PID belongs to the worker launched by this test and was recorded by its onStart callback.
    process.kill(root.pid, 'SIGKILL');
    const ended = await until(
      () => call('status', submitted.runId),
      status => status.record.status === 'failed',
    );
    assert.equal(ended.snapshot.status, 'failed');
    evidence.push({ mode, submitted, killedPid: root.pid, ended });
  } else {
    const ended = await until(
      () => call('status', submitted.runId),
      status => status.record.status === 'success',
    );
    assert.equal(ended.record.result.result.value, 35);
    assert.equal(ended.snapshot.status, 'success');
    evidence.push({ mode, submitted, ended });
  }
  console.log(`PASS: ${mode} across client processes`);
}
writeFileSync('.scratch/lifecycle-observations.json', JSON.stringify(evidence, null, 2));
