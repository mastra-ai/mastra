import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/slack', () => ({ createSlackAdapter: vi.fn(() => ({})) }));

import { SlackIntegration } from './integration.js';

const fetchMock = vi.fn<typeof fetch>();
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fixture({ token = 'bot-token', linked = true, routed = true, teamId = 'T1' } = {}) {
  fetchMock
    .mockReset()
    .mockImplementation(
      async url =>
        new Response(
          JSON.stringify(
            String(url).includes('auth.test')
              ? { ok: true, team_id: 'T1', bot_id: 'B1' }
              : { ok: true, members: [{ id: 'U1', name: 'caleb' }] },
          ),
        ),
    );
  vi.stubGlobal('fetch', fetchMock);
  const integration = new SlackIntegration({ signingSecret: 'secret', botToken: token });
  const config = integration.channels({
    storage: {
      channelIdentity: {
        getAccountLink: vi
          .fn()
          .mockResolvedValue(linked ? { userId: 'user-1', orgId: 'org-1', defaultFactoryProjectId: 'fp-1' } : null),
      },
      projects: { get: vi.fn().mockResolvedValue(routed ? { id: 'fp-1' } : null), list: vi.fn().mockResolvedValue([]) },
    },
    rules: {},
  } as any);
  const thread = {
    id: 'slack:C1:1',
    adapter: { name: 'slack' },
    channelId: 'C1',
    isSubscribed: vi.fn().mockResolvedValue(true),
    postEphemeral: vi.fn(),
    post: vi.fn(),
  } as any;
  const message = {
    text: 'hello',
    author: { userId: 'U2', userName: 'sender' },
    raw: teamId ? { team_id: teamId } : {},
  } as any;
  const requestContext = new RequestContext();
  return { integration, config, thread, message, requestContext };
}

async function route(
  f: ReturnType<typeof fixture>,
  handler: 'onSubscribedMessage' | 'onMention' | 'onDirectMessage' = 'onSubscribedMessage',
) {
  await f.config.handlers![handler]!(f.thread, f.message, vi.fn(), {
    requestContext: f.requestContext,
    mastra: {} as any,
  });
  return f.integration.agentTools({ requestContext: f.requestContext });
}

describe('authorized Slack directory tool', () => {
  it.each(['onSubscribedMessage', 'onMention', 'onDirectMessage'] as const)(
    'offers and executes the read-only tool after %s routing',
    async handler => {
      const f = fixture();
      const tools = await route(f, handler);
      expect(Object.keys(tools)).toEqual(['find_slack_user']);
      const result = await tools.find_slack_user!.execute!({ query: 'caleb' }, { requestContext: f.requestContext });
      expect(result).toMatchObject({ candidates: [{ id: 'U1', mention: '<@U1>' }] });
      expect(fetchMock.mock.calls.every(([url]) => /\/(auth.test|users.list)\?/.test(String(url)))).toBe(true);
    },
  );

  it.each([{ linked: false }, { routed: false }, { teamId: '' }, { token: '' }, { teamId: 'T2' }])(
    'does not offer lookup outside an authorized workspace: %j',
    async options => {
      const f = fixture(options);
      expect(await route(f)).toEqual({});
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('users.list'))).toBe(false);
    },
  );

  it('does not trust web/CLI context values, persisted metadata, or a grant from another integration', async () => {
    const f = fixture();
    f.requestContext.set('channel', 'slack');
    f.requestContext.set('slackTeamId', 'T1');
    f.requestContext.set('user', { id: 'user-1', organizationId: 'org-1' });
    expect(await f.integration.agentTools({ requestContext: f.requestContext })).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
    await route(f);
    const other = new SlackIntegration({ signingSecret: 'secret', botToken: 'other' });
    expect(await other.agentTools({ requestContext: f.requestContext })).toEqual({});
  });

  it('rechecks authorization when executing a previously resolved tool', async () => {
    const f = fixture();
    const tools = await route(f);
    expect(
      await tools.find_slack_user!.execute!({ query: 'caleb' }, { requestContext: new RequestContext() }),
    ).toMatchObject({ error: 'Slack workspace is not authorized.' });
    f.requestContext.set('user', { id: 'different-user' });
    expect(
      await tools.find_slack_user!.execute!({ query: 'caleb' }, { requestContext: f.requestContext }),
    ).toMatchObject({ error: 'Slack workspace is not authorized.' });
    expect(await f.integration.agentTools({ requestContext: f.requestContext })).toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps credential errors from breaking tool resolution', async () => {
    const f = fixture();
    fetchMock.mockRejectedValueOnce(new Error('private-token'));
    expect(await route(f)).toEqual({});
  });

  it('surfaces safe missing-scope errors from lookup', async () => {
    const f = fixture();
    const tools = await route(f);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: 'missing_scope' })));
    expect(
      await tools.find_slack_user!.execute!({ query: 'caleb' }, { requestContext: f.requestContext }),
    ).toMatchObject({ error: 'Slack lookup requires the users:read bot scope.', retryable: false });
  });
});
