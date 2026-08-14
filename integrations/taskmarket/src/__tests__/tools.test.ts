import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  TaskmarketAuthorizationError,
  TaskmarketFundingError,
  TaskmarketNetworkError,
  buildCreatePreview,
  validateCreateConfig,
} from '../create.js';
import { createTaskmarketCreateTaskTool, createTaskmarketSubmissionsTool, createTaskmarketTaskStatusTool } from '../tools.js';

const TASK_ID = '0x' + 'ef'.repeat(32);
const WALLET = '0x7e0190af0951485dFd08bE2FE19Fa638e94F426D';
const WORKER = '0x03dB205d6a3BE1bd80d5086f8F78F42B813F4a73';

function makeFakeCli(script: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'tm-fake-cli-'));
  const path = join(dir, 'taskmarket');
  writeFileSync(path, `#!/usr/bin/env node\n${script}\n`, { mode: 0o755 });
  return path;
}

const DEPOSIT_PAYLOAD = `{ address: "${WALLET}", network: "Base", chainId: 8453, currency: "USDC", usdcContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }`;
const BALANCE_PAYLOAD = `{ address: "${WALLET}", balanceBaseUnits: "50000000", balanceUsdc: "50.000000" }`;

function fullFlowCli(): string {
  return `
const mode = (process.argv[2] ?? '') + (process.argv[3] ? ' ' + process.argv[3] : '');
if (mode === 'deposit') {
  process.stdout.write(JSON.stringify({ ok: true, data: ${DEPOSIT_PAYLOAD} }) + '\\n');
} else if (mode === 'wallet balance') {
  process.stdout.write(JSON.stringify({ ok: true, data: ${BALANCE_PAYLOAD} }) + '\\n');
} else if (mode === 'task create') {
  process.stdout.write(JSON.stringify({ ok: true, data: { taskId: "${TASK_ID}" }, idempotencyKey: "018fcreate" }) + '\\n');
} else if (mode === 'task get') {
  process.stdout.write(JSON.stringify({ ok: true, data: { id: "${TASK_ID}", status: "open", phase: "active", submissionCount: 0, requester: "${WALLET}" } }) + '\\n');
} else if (mode === 'task submissions') {
  process.stdout.write(JSON.stringify({ ok: true, data: [] }) + '\\n');
} else {
  process.stdout.write(JSON.stringify({ ok: true, data: {} }) + '\\n');
}
`;
}

function inputFor(previewCode: string, overrides: Record<string, unknown> = {}) {
  return {
    description: 'Write a one-page summary of the Base agentic economy in 2026.',
    rewardUsdc: '25',
    durationHours: 72,
    maxSpendUsdc: '25',
    tags: ['research'],
    confirm: previewCode,
    ...overrides,
  };
}

describe('createTaskmarketCreateTaskTool', () => {
  let cliPath: string;

  beforeEach(() => {
    cliPath = makeFakeCli(fullFlowCli());
  });

  afterEach(() => {
    delete process.env.FAKE_CHAIN_ID;
  });

  it('refuses to create without the confirmation code', async () => {
    const tool = createTaskmarketCreateTaskTool({ cliPath });
    await expect(tool.execute!(inputFor('wrong-code'), {} as any)).rejects.toThrow(
      TaskmarketAuthorizationError,
    );
    await expect(tool.execute!(inputFor('wrong-code'), {} as any)).rejects.toThrow(
      /exact confirmation code/,
    );
  });

  it('refuses to create with a confirmation code for a different task', async () => {
    const tool = createTaskmarketCreateTaskTool({ cliPath });
    const otherPreview = buildCreatePreview(
      validateCreateConfig({
        description: 'A completely different task description for the test.',
        rewardUsdc: '25',
        durationHours: 72,
        mode: 'bounty',
        taskVisibility: 'public',
        submissionVisibility: 'public',
        maxSpendUsdc: '25',
        tags: [],
      }).config,
    );
    await expect(tool.execute!(inputFor(otherPreview.confirmationCode), {} as any)).rejects.toThrow(
      /exact confirmation code/,
    );
  });

  it('creates a task after preview and confirmation, returning id, link, and status', async () => {
    const tool = createTaskmarketCreateTaskTool({ cliPath });
    // Build the preview from the exact same input the tool will receive.
    const validated = validateCreateConfig({
      description: 'Write a one-page summary of the Base agentic economy in 2026.',
      rewardUsdc: '25',
      durationHours: 72,
      mode: 'bounty',
      taskVisibility: 'public',
      submissionVisibility: 'public',
      maxSpendUsdc: '25',
      tags: ['research'],
    });
    const code = buildCreatePreview(validated.config).confirmationCode;

    const out = await tool.execute!(inputFor(code), {} as any);

    expect(out.taskId).toBe(TASK_ID);
    expect(out.taskUrl).toBe(`https://taskmarket.dev/tasks/${TASK_ID}`);
    expect(out.idempotencyKey).toBe('018fcreate');
    expect(out.status).toContain('status=open');
    expect(out.walletAddress).toBe(WALLET);
  });

  it('refuses when the configured backend is not Base Mainnet', async () => {
    const path = makeFakeCli(`
process.stdout.write(JSON.stringify({ ok: true, data: { address: "${WALLET}", network: "Ethereum", chainId: 1, currency: "USDC", usdcContract: "0x0000000000000000000000000000000000000000" } }) + '\\n');
`);
    const tool = createTaskmarketCreateTaskTool({ cliPath: path });
    const validated = validateCreateConfig({
      description: 'Write a one-page summary of the Base agentic economy in 2026.',
      rewardUsdc: '25',
      durationHours: 72,
      mode: 'bounty',
      taskVisibility: 'public',
      submissionVisibility: 'public',
      maxSpendUsdc: '25',
      tags: ['research'],
    });
    const code = buildCreatePreview(validated.config).confirmationCode;

    await expect(tool.execute!(inputFor(code), {} as any)).rejects.toThrow(TaskmarketNetworkError);
    await expect(tool.execute!(inputFor(code), {} as any)).rejects.toThrow(/Refusing to act/);
  });

  it('refuses when the wallet cannot cover the max spend', async () => {
    const path = makeFakeCli(`
const mode = (process.argv[2] ?? '') + (process.argv[3] ? ' ' + process.argv[3] : '');
if (mode === 'deposit') {
  process.stdout.write(JSON.stringify({ ok: true, data: ${DEPOSIT_PAYLOAD} }) + '\\n');
} else {
  process.stdout.write(JSON.stringify({ ok: true, data: { address: "${WALLET}", balanceBaseUnits: "1000000", balanceUsdc: "1.000000" } }) + '\\n');
}
`);
    const tool = createTaskmarketCreateTaskTool({ cliPath: path });
    const validated = validateCreateConfig({
      description: 'Write a one-page summary of the Base agentic economy in 2026.',
      rewardUsdc: '25',
      durationHours: 72,
      mode: 'bounty',
      taskVisibility: 'public',
      submissionVisibility: 'public',
      maxSpendUsdc: '25',
      tags: ['research'],
    });
    const code = buildCreatePreview(validated.config).confirmationCode;

    await expect(tool.execute!(inputFor(code), {} as any)).rejects.toThrow(TaskmarketFundingError);
    await expect(tool.execute!(inputFor(code), {} as any)).rejects.toThrow(/Insufficient USDC/);
  });

  it('fails validation before any CLI call for a bad reward', async () => {
    const tool = createTaskmarketCreateTaskTool({ cliPath });
    const validated = validateCreateConfig({
      description: 'Write a one-page summary of the Base agentic economy in 2026.',
      rewardUsdc: '25',
      durationHours: 72,
      mode: 'bounty',
      taskVisibility: 'public',
      submissionVisibility: 'public',
      maxSpendUsdc: '25',
      tags: ['research'],
    });
    const code = buildCreatePreview(validated.config).confirmationCode;

    // Zod rejects the bad reward at the schema boundary before execute runs.
    const out = (await tool.execute!(
      inputFor(code, { rewardUsdc: 'not-a-number' }),
      {} as any,
    )) as { error?: boolean; message?: string };
    expect(out.error).toBe(true);
    expect(out.message ?? '').toMatch(/rewardUsdc/);
  });
});

describe('createTaskmarketTaskStatusTool', () => {
  it('returns the live task status', async () => {
    const path = makeFakeCli(`
process.stdout.write(JSON.stringify({ ok: true, data: { id: "${TASK_ID}", status: "open", phase: "active", reward: "25000000", netReward: "23125000", platformFeeBps: 750, expiryTime: "2026-09-01T00:00:00.000Z", submissionWindowOpen: true, submissionCount: 3, requester: "${WALLET}" } }) + '\\n');
`);
    const tool = createTaskmarketTaskStatusTool({ cliPath: path });

    const out = await tool.execute!({ taskId: TASK_ID }, {} as any);

    expect(out.status).toBe('open');
    expect(out.phase).toBe('active');
    expect(out.rewardBaseUnits).toBe('25000000');
    expect(out.platformFeeBps).toBe(750);
    expect(out.submissionWindowOpen).toBe(true);
    expect(out.submissionCount).toBe(3);
    expect(out.taskUrl).toBe(`https://taskmarket.dev/tasks/${TASK_ID}`);
  });

  it('rejects a malformed task id at the schema boundary', async () => {
    const tool = createTaskmarketTaskStatusTool({ cliPath: makeFakeCli('') });
    const out = (await tool.execute!({ taskId: 'not-a-task-id' }, {} as any)) as {
      error?: boolean;
    };
    expect(out.error).toBe(true);
  });
});

describe('createTaskmarketSubmissionsTool', () => {
  it('lists submissions for human review without accepting or rejecting', async () => {
    const path = makeFakeCli(`
process.stdout.write(JSON.stringify({ ok: true, data: [
  { id: "sub_1", taskId: "${TASK_ID}", workerAddress: "${WORKER}", workerAgentId: "60048", submittedAt: "2026-08-11T20:39:47.262Z", rejectedAt: null, deliverableHash: "0xa9d076414ff24e9ec2bdb698c0654169df9b50f1c2cc8cb902c73d961ff8ac91", submitTxHash: "0xb126fee5a203b8deb20577bf9b02e022d766edfe42e8c4dd49c761159850a2e1" }
]}) + '\\n');
`);
    const tool = createTaskmarketSubmissionsTool({ cliPath: path });

    const out = await tool.execute!({ taskId: TASK_ID }, {} as any);

    expect(out.taskId).toBe(TASK_ID);
    expect(out.submissionCount).toBe(1);
    expect(out.submissions[0]!.id).toBe('sub_1');
    expect(out.submissions[0]!.workerAddress).toBe(WORKER);
    expect(out.submissions[0]!.deliverableHash).toMatch(/^0x/);
    expect(out.reviewInstruction).toMatch(/human/);
    expect(out.reviewInstruction).toMatch(/never accepts or rejects/);
  });
});
