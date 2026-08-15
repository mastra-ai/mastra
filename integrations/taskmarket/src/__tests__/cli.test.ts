import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  execSync: vi.fn(() => 'C:\\global\\node_modules'),
}));

vi.mock('node:child_process', () => ({
  execFile: mocks.execFile,
  execSync: mocks.execSync,
}));

import { createTask, taskmarketCliEntry } from '../cli.js';

describe('taskmarketCliEntry', () => {
  it('resolves the first-party CLI entry under npm global root', () => {
    expect(taskmarketCliEntry()).toContain('@lucid-agents');
    expect(taskmarketCliEntry()).toContain('taskmarket');
    expect(taskmarketCliEntry()).toContain('index.js');
  });
});

describe('createTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TASKMARKET_MAX_SPEND_USDC;
  });

  afterEach(() => {
    delete process.env.TASKMARKET_MAX_SPEND_USDC;
  });

  it('returns requires_confirmation without calling the CLI', async () => {
    const result = await createTask({
      description: 'd',
      rewardUsdc: 5,
      durationHours: 24,
      confirmation: false,
    });
    expect(result.status).toBe('requires_confirmation');
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it('enforces the env ceiling over the tool-call cap', async () => {
    process.env.TASKMARKET_MAX_SPEND_USDC = '2';
    const result = await createTask({
      description: 'd',
      rewardUsdc: 1,
      durationHours: 24,
      maxSpendUsdc: 100,
      confirmation: false,
    });
    expect((result.plan as Record<string, unknown>).maxSpendUsdc).toBe(2);
  });

  it('throws when the reward exceeds the ceiling', async () => {
    process.env.TASKMARKET_MAX_SPEND_USDC = '2';
    await expect(
      createTask({ description: 'd', rewardUsdc: 5, durationHours: 24, confirmation: true }),
    ).rejects.toThrow('exceeds the spending limit');
  });

  it('parses the ok envelope and returns the task id', async () => {
    mocks.execFile.mockImplementation((_file: string, _args: string[], _opts: unknown, cb: (e: null, so: string, se: string) => void) =>
      cb(null, JSON.stringify({ ok: true, data: { taskId: '0xabc' } }), ''),
    );
    const result = await createTask({
      description: 'd',
      rewardUsdc: 5,
      durationHours: 24,
      confirmation: true,
    });
    expect(result.status).toBe('submitted');
    expect(result.taskId).toBe('0xabc');
    const callArgs = mocks.execFile.mock.calls[0]?.[1] as string[];
    expect(callArgs).toContain('task');
    expect(callArgs).toContain('create');
    expect(callArgs).toContain('--reward');
  });

  it('never retries a pending (unknown settlement) failure', async () => {
    mocks.execFile.mockImplementation((_file: string, _args: string[], _opts: unknown, cb: (e: null, so: string, se: string) => void) =>
      cb(null, '', JSON.stringify({ ok: false, pending: true })),
    );
    await expect(
      createTask({ description: 'd', rewardUsdc: 5, durationHours: 24, confirmation: true }),
    ).rejects.toThrow('unknown settlement');
    expect(mocks.execFile).toHaveBeenCalledTimes(1);
  });

  it('surfaces a non-envelope stderr failure', async () => {
    mocks.execFile.mockImplementation((_file: string, _args: string[], _opts: unknown, cb: (e: null, so: string, se: string) => void) =>
      cb(null, '', 'oops something broke'),
    );
    await expect(
      createTask({ description: 'd', rewardUsdc: 5, durationHours: 24, confirmation: true }),
    ).rejects.toThrow('oops something broke');
  });
});
