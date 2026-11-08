import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraClient } from '../client';
import type { Computer } from './computer';

globalThis.fetch = vi.fn();

function respond(data: unknown) {
  const response = new Response(undefined, { status: 200, headers: { 'Content-Type': 'application/json' } });
  response.json = () => Promise.resolve(data);
  vi.mocked(globalThis.fetch).mockResolvedValueOnce(response);
}

describe('Computer resource', () => {
  let computer: Computer;

  beforeEach(() => {
    vi.clearAllMocks();
    computer = new MastraClient({ baseUrl: 'http://localhost:4111' }).getComputer('computer/id');
  });

  it('creates a viewer session', async () => {
    respond({ state: 'ready', socketUrl: '/computer/c/websockify?ticket=t' });
    await expect(computer.createSession({ threadId: 't', resourceId: 'r', mode: 'control' })).resolves.toEqual({
      state: 'ready',
      socketUrl: '/computer/c/websockify?ticket=t',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/computers/computer%2Fid/session',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ threadId: 't', resourceId: 'r', mode: 'control' }),
      }),
    );
  });

  it('reads control with encoded scope query parameters', async () => {
    respond({ holder: 'agent', revision: 2 });
    await computer.getControl({ threadId: 'thread/id', resourceId: 'resource id' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/computers/computer%2Fid/control?threadId=thread%2Fid&resourceId=resource+id',
      expect.any(Object),
    );
  });

  it('changes control', async () => {
    respond({ holder: 'human', revision: 3, notified: true });
    await expect(computer.changeControl({ action: 'take', note: 'login' })).resolves.toEqual({
      holder: 'human',
      revision: 3,
      notified: true,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/computers/computer%2Fid/control',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ action: 'take', note: 'login' }) }),
    );
  });
});
