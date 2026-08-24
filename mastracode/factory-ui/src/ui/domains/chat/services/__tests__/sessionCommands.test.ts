import { afterEach, describe, expect, it, vi } from 'vitest';

import { discoverSessionCommandsViaFetch, prepareSessionCommandViaFetch } from '../sessionCommands';

const ADDRESS = {
  agentControllerId: 'code',
  resourceId: 'resource-1',
  projectRepositoryId: '00000000-0000-4000-8000-000000000001',
  scope: '/worktrees/a',
  baseUrl: 'http://localhost:4111',
};

const DISCOVERY_BODY = {
  capabilities: { customCommands: 'supported', skills: 'supported' },
  commands: [
    { command: '//review', source: 'custom', name: 'review', description: 'Review it', goal: false },
    { command: '/skill/understand-pr', source: 'skill', name: 'understand-pr', description: 'PRs', goal: false },
  ],
} as const;

describe('sessionCommands service', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('discovers commands through a credentialed POST carrying the exact address', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(DISCOVERY_BODY), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverSessionCommandsViaFetch(ADDRESS);

    expect(result.commands.map(command => command.command)).toEqual(['//review', '/skill/understand-pr']);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/commands/discover');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(String(init.body))).toEqual({
      resourceId: 'resource-1',
      projectRepositoryId: '00000000-0000-4000-8000-000000000001',
      scope: '/worktrees/a',
    });
  });

  it('prepares a command and returns the discriminated outcome untouched', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ action: 'goal', objective: 'Ship it' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await prepareSessionCommandViaFetch(ADDRESS, { command: '/goal/deploy', arguments: 'now' });

    expect(outcome).toEqual({ action: 'goal', objective: 'Ship it' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:4111/api/agent-controller/code/commands/prepare');
    expect(JSON.parse(String(init.body))).toEqual({
      resourceId: 'resource-1',
      projectRepositoryId: '00000000-0000-4000-8000-000000000001',
      scope: '/worktrees/a',
      command: '/goal/deploy',
      arguments: 'now',
    });
  });

  it('surfaces the server error message on failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'command_not_found', message: 'Unknown command: //missing' }), {
            status: 404,
          }),
      ),
    );

    await expect(prepareSessionCommandViaFetch(ADDRESS, { command: '//missing' })).rejects.toThrow(
      'Unknown command: //missing',
    );
  });
});
