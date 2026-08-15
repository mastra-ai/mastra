import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTaskmarketTools } from '../tools.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createTaskmarketTools', () => {
  it('exposes the five tools with stable keys', () => {
    const tools = createTaskmarketTools();
    expect(Object.keys(tools)).toEqual([
      'taskmarketListOpenTasks',
      'taskmarketGetTask',
      'taskmarketTrackTask',
      'taskmarketCreateTask',
      'taskmarketListSubmissions',
    ]);
  });

  it('list tool execute hits the API and normalizes rewards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            tasks: [
              { id: '0x1', reward: '64000000', description: 'd', mode: 'bounty', status: 'open', submissionCount: 2, tags: [] },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const tools = createTaskmarketTools();
    const out = await tools.taskmarketListOpenTasks.execute({ limit: 20 });
    expect(out.count).toBe(1);
    expect((out.tasks[0] as Record<string, unknown>).rewardUsdc).toBe(64);
  });

  it('track tool returns live status fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: '0x1',
            requester: '0xabc',
            reward: '5000000',
            mode: 'bounty',
            status: 'open',
            submissionCount: 7,
            expiryTime: '2026-08-22T00:00:00.000Z',
            tags: [],
          }),
          { status: 200 },
        ),
      ),
    );
    const tools = createTaskmarketTools();
    const out = await tools.taskmarketTrackTask.execute({ taskId: '0x1' });
    expect(out.status).toBe('open');
    expect(out.rewardUsdc).toBe(5);
    expect(out.submissionCount).toBe(7);
    expect(out.requester).toBe('0xabc');
  });

  it('create task tool requires confirmation by default', async () => {
    const tools = createTaskmarketTools();
    const out = await tools.taskmarketCreateTask.execute({
      description: 'd',
      rewardUsdc: 5,
      durationHours: 24,
    });
    expect(out.status).toBe('requires_confirmation');
    expect((out.plan as Record<string, unknown>).maxSpendUsdc).toBe(10);
  });
});
