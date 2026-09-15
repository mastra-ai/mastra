import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from './client';

global.fetch = vi.fn();

function mockJsonResponse() {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => ({}),
  });
}

function lastFetchUrl(): string {
  const calls = (global.fetch as any).mock.calls;
  return calls[calls.length - 1][0] as string;
}

describe('MastraClient logs pagination params', () => {
  let client: MastraClient;

  beforeEach(() => {
    (global.fetch as any).mockClear();
    client = new MastraClient({ baseUrl: 'http://localhost:3000' });
  });

  it('listLogs sends page and perPage even when they are 0', async () => {
    mockJsonResponse();
    await client.listLogs({ transportId: 't', page: 0, perPage: 0 });

    const url = lastFetchUrl();
    expect(url).toContain('page=0');
    expect(url).toContain('perPage=0');
  });

  it('getLogForRun sends page and perPage even when they are 0', async () => {
    mockJsonResponse();
    await client.getLogForRun({ runId: 'r', transportId: 't', page: 0, perPage: 0 });

    const url = lastFetchUrl();
    expect(url).toContain('page=0');
    expect(url).toContain('perPage=0');
  });
});
