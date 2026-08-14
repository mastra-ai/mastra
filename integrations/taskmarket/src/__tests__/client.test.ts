import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TaskmarketCliError, TaskmarketClient, taskmarketTaskUrl } from '../client.js';

const TASK_ID = '0x' + 'cd'.repeat(32);

function makeFakeCli(script: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'tm-fake-cli-'));
  const path = join(dir, 'taskmarket');
  writeFileSync(path, `#!/usr/bin/env node\n${script}\n`, { mode: 0o755 });
  return path;
}

function successScript(payload: string): string {
  return `process.stdout.write(JSON.stringify({ ok: true, data: ${payload} }) + '\\n');`;
}

describe('TaskmarketClient', () => {
  let cliPath: string;

  beforeEach(() => {
    cliPath = makeFakeCli(successScript('{ taskId: "0x1234" }'));
  });

  afterEach(() => {
    delete process.env.TASKMARKET_CLI_PATH;
  });

  it('uses TASKMARKET_CLI_PATH when cliPath is not given', async () => {
    process.env.TASKMARKET_CLI_PATH = cliPath;
    const client = new TaskmarketClient();
    const { data } = await client.run(['task', 'get', TASK_ID]);
    expect(data).toEqual({ taskId: '0x1234' });
  });

  it('parses a success envelope from stdout', async () => {
    const client = new TaskmarketClient({ cliPath });
    const { data } = await client.run(['task', 'get', TASK_ID]);
    expect(data).toEqual({ taskId: '0x1234' });
  });

  it('surfaces the idempotency key from a success envelope', async () => {
    const path = makeFakeCli(
      `process.stdout.write(JSON.stringify({ ok: true, data: { taskId: "0x1" }, idempotencyKey: "018fabc" }) + '\\n');`,
    );
    const client = new TaskmarketClient({ cliPath: path });
    const { idempotencyKey } = await client.run(['task', 'create', '--description', 'x']);
    expect(idempotencyKey).toBe('018fabc');
  });

  it('throws a TaskmarketCliError with the envelope fields on a CLI failure', async () => {
    const path = makeFakeCli(
      `process.stderr.write(JSON.stringify({ ok: false, error: 'task not found', status: 404 }) + '\\n'); process.exit(1);`,
    );
    const client = new TaskmarketClient({ cliPath: path });
    await expect(client.run(['task', 'get', TASK_ID])).rejects.toThrow(TaskmarketCliError);
    await expect(client.run(['task', 'get', TASK_ID])).rejects.toThrow(/task not found/);
    await expect(client.run(['task', 'get', TASK_ID])).rejects.toMatchObject({ status: 404 });
  });

  it('marks in-flight writes as pending', async () => {
    const path = makeFakeCli(
      `process.stderr.write(JSON.stringify({ ok: false, error: 'write in flight', status: 409, reason: 'intent_in_flight', intentId: 'intent_1', pending: true, idempotencyKey: '018fabc' }) + '\\n'); process.exit(1);`,
    );
    const client = new TaskmarketClient({ cliPath: path });
    await expect(client.run(['task', 'create', '--description', 'x'])).rejects.toMatchObject({
      pending: true,
      reason: 'intent_in_flight',
      intentId: 'intent_1',
      idempotencyKey: '018fabc',
    });
  });

  it('throws a timed-out error with timedOut set when the CLI hangs', async () => {
    const path = makeFakeCli(`setTimeout(() => {}, 60000);`);
    const client = new TaskmarketClient({ cliPath: path, timeoutMs: 500 });
    await expect(client.run(['task', 'get', TASK_ID])).rejects.toMatchObject({ timedOut: true });
    await expect(client.run(['task', 'get', TASK_ID])).rejects.toThrow(/do not retry automatically/);
  });

  it('throws a readable error when the CLI is missing', async () => {
    const client = new TaskmarketClient({ cliPath: '/nonexistent/taskmarket' });
    await expect(client.run(['task', 'get', TASK_ID])).rejects.toThrow(TaskmarketCliError);
  });

  it('returns a task url on the public web app', () => {
    expect(taskmarketTaskUrl(TASK_ID)).toBe(`https://taskmarket.dev/tasks/${TASK_ID}`);
  });
});

describe('task status retrieval', () => {
  it('getTask parses status, phase, reward, and submission count', async () => {
    const payload = `{
      id: "${TASK_ID}",
      status: "open",
      phase: "active",
      reward: "25000000",
      netReward: "23125000",
      platformFeeBps: 750,
      expiryTime: "2026-09-01T00:00:00.000Z",
      submissionWindowOpen: true,
      submissionCount: 2,
      requester: "0x93710f148a88d80B344BB1fEbB91DCBA9f80019F"
    }`;
    const client = new TaskmarketClient({ cliPath: makeFakeCli(successScript(payload)) });

    const task = await client.getTask(TASK_ID);
    expect(task.id).toBe(TASK_ID);
    expect(task.status).toBe('open');
    expect(task.phase).toBe('active');
    expect(task.reward).toBe('25000000');
    expect(task.platformFeeBps).toBe(750);
    expect(task.submissionWindowOpen).toBe(true);
    expect(task.submissionCount).toBe(2);
    expect(task.requester).toBe('0x93710f148a88d80B344BB1fEbB91DCBA9f80019F');
  });
});

describe('submissions listing', () => {
  it('submissions parses the worker list for human review', async () => {
    const payload = `[
      {
        id: "sub_1",
        taskId: "${TASK_ID}",
        workerAddress: "0x03dB205d6a3BE1bd80d5086f8F78F42B813F4a73",
        workerAgentId: "60048",
        submittedAt: "2026-08-11T20:39:47.262Z",
        rejectedAt: null,
        deliverableHash: "0xa9d076414ff24e9ec2bdb698c0654169df9b50f1c2cc8cb902c73d961ff8ac91",
        submitTxHash: "0xb126fee5a203b8deb20577bf9b02e022d766edfe42e8c4dd49c761159850a2e1"
      }
    ]`;
    const client = new TaskmarketClient({ cliPath: makeFakeCli(successScript(payload)) });

    const submissions = await client.submissions(TASK_ID);
    expect(submissions).toHaveLength(1);
    expect(submissions[0]!.id).toBe('sub_1');
    expect(submissions[0]!.workerAddress).toBe('0x03dB205d6a3BE1bd80d5086f8F78F42B813F4a73');
    expect(submissions[0]!.submittedAt).toBe('2026-08-11T20:39:47.262Z');
    expect(submissions[0]!.rejectedAt).toBeNull();
  });
});

describe('deposit and balance', () => {
  it('deposit parses the network identity', async () => {
    const payload = `{
      address: "0x7e0190af0951485dFd08bE2FE19Fa638e94F426D",
      network: "Base",
      chainId: 8453,
      currency: "USDC",
      usdcContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    }`;
    const client = new TaskmarketClient({ cliPath: makeFakeCli(successScript(payload)) });
    const deposit = await client.deposit();
    expect(deposit.chainId).toBe(8453);
    expect(deposit.network).toBe('Base');
  });

  it('walletAddress returns the address', async () => {
    const payload = `{ address: "0x7e0190af0951485dFd08bE2FE19Fa638e94F426D" }`;
    const client = new TaskmarketClient({ cliPath: makeFakeCli(successScript(payload)) });
    await expect(client.walletAddress()).resolves.toBe(
      '0x7e0190af0951485dFd08bE2FE19Fa638e94F426D',
    );
  });

  it('walletAddress throws when the address is missing', async () => {
    const client = new TaskmarketClient({ cliPath: makeFakeCli(successScript('{}')) });
    await expect(client.walletAddress()).rejects.toThrow(/no wallet address/);
  });
});

describe('task creation', () => {
  it('createTask returns the task id and idempotency key', async () => {
    const path = makeFakeCli(
      `process.stdout.write(JSON.stringify({ ok: true, data: { taskId: "${TASK_ID}" }, idempotencyKey: "018fkey" }) + '\\n');`,
    );
    const client = new TaskmarketClient({ cliPath: path });
    const result = await client.createTask(['--description', 'x']);
    expect(result.taskId).toBe(TASK_ID);
    expect(result.idempotencyKey).toBe('018fkey');
  });

  it('createTask throws when the response has no task id', async () => {
    const client = new TaskmarketClient({ cliPath: makeFakeCli(successScript('{}')) });
    await expect(client.createTask(['--description', 'x'])).rejects.toThrow(/no taskId/);
  });
});
