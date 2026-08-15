import { afterEach, describe, expect, it, vi } from 'vitest';

import { TaskmarketClient } from '../api.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TaskmarketClient.listTasks', () => {
  it('converts reward base units to USDC', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        tasks: [
          {
            id: '0x1',
            reward: '64000000',
            description: 'd',
            mode: 'bounty',
            status: 'open',
            submissionCount: 2,
            tags: [],
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await new TaskmarketClient().listTasks();
    expect(result.tasks[0]?.rewardUsdc).toBe(64);
  });

  it('rounds fractional minRewardUsdc to whole base units', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ tasks: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await new TaskmarketClient().listTasks({ minRewardUsdc: 0.3 });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('minReward=300000');
    expect(url).not.toContain('299999');
  });

  it('passes mode and fetches a superset when any filter is active', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ tasks: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await new TaskmarketClient().listTasks({ mode: 'claim', minRewardUsdc: 1, limit: 5 });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('mode=claim');
    expect(url).toContain('minReward=1000000');
    expect(url).toContain('limit=100');
  });

  it('filters client-side by maxRewardUsdc and applies the limit', async () => {
    const tasks = [
      { id: 'a', reward: '5000000', description: 'd', mode: 'bounty', status: 'open', submissionCount: 0, tags: [] },
      { id: 'b', reward: '2000000', description: 'd', mode: 'bounty', status: 'open', submissionCount: 0, tags: [] },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ tasks })));
    const result = await new TaskmarketClient().listTasks({ maxRewardUsdc: 3, limit: 10 });
    expect(result.tasks.map(t => t.id)).toEqual(['b']);
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    await expect(new TaskmarketClient().listTasks()).rejects.toThrow('HTTP 500');
  });
});

describe('TaskmarketClient.getTask / listSubmissions', () => {
  it('compacts a task and keeps requester and pendingActions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: '0x1',
          requester: '0xabc',
          requesterAgentId: '42',
          pendingActions: [{ action: 'review' }],
          reward: '1000000',
          tags: [],
        }),
      ),
    );
    const { task } = await new TaskmarketClient().getTask('0x1');
    expect(task.requester).toBe('0xabc');
    expect(task.requesterAgentId).toBe('42');
    expect(task.rewardUsdc).toBe(1);
    expect(task.pendingActions).toEqual([{ action: 'review' }]);
  });

  it('returns submissions with a human-review note', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          submissions: [{ id: 'sub-1', workerAddress: '0x1', fileUrl: 'https://x/y.md' }],
        }),
      ),
    );
    const result = await new TaskmarketClient().listSubmissions('0x1');
    expect(result.count).toBe(1);
    expect(result.submissions[0]?.deliverableUrl).toBe('https://x/y.md');
    expect(result.reviewNote).toContain('human requester');
  });
});
