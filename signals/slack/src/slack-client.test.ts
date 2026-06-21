import { describe, expect, it, vi } from 'vitest';

import { SlackSignalsApiError, SlackWebApiSyncClient } from './slack-client.js';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    ...init,
  });
}

function getRequestBody(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0): URLSearchParams {
  const init = fetchMock.mock.calls[callIndex]![1] as RequestInit;
  return init.body as URLSearchParams;
}

describe('SlackWebApiSyncClient', () => {
  it('requests workspace identity with auth.test', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        team_id: 'T123',
        team: 'Mastra',
        user_id: 'U123',
        bot_id: 'B123',
        url: 'https://mastra.slack.com/',
      }),
    );
    const client = new SlackWebApiSyncClient({ token: 'xoxp-test', baseUrl: 'https://slack.test/api', fetch: fetchMock as any });

    await expect(client.getWorkspace()).resolves.toEqual({
      teamId: 'T123',
      teamName: 'Mastra',
      userId: 'U123',
      botId: 'B123',
      url: 'https://mastra.slack.com/',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://slack.test/api/auth.test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer xoxp-test' }),
      }),
    );
  });

  it('drains conversations.list pages with transient Slack cursors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          channels: [
            { id: 'C1', name: 'general', is_channel: true, is_private: false, is_member: true },
            { id: 'D1', is_im: true, user: 'U1' },
          ],
          response_metadata: { next_cursor: 'cursor-2' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          channels: [{ id: 'G1', name: 'private', is_group: true, is_private: true }],
          response_metadata: { next_cursor: '' },
        }),
      );
    const client = new SlackWebApiSyncClient({ token: 'xoxp-test', baseUrl: 'https://slack.test/api/', fetch: fetchMock as any });

    await expect(
      client.listConversations({ types: ['public_channel', 'private_channel', 'im', 'mpim'], limit: 100 }),
    ).resolves.toEqual({
      conversations: [
        { id: 'C1', name: 'general', type: 'public_channel', isMember: true },
        { id: 'D1', type: 'im', user: 'U1' },
        { id: 'G1', name: 'private', type: 'private_channel' },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRequestBody(fetchMock).get('types')).toBe('public_channel,private_channel,im,mpim');
    expect(getRequestBody(fetchMock).get('exclude_archived')).toBe('true');
    expect(getRequestBody(fetchMock, 1).get('cursor')).toBe('cursor-2');
  });

  it('lists user conversations with users.conversations', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        channels: [{ id: 'GMP1', name: 'project-group', is_mpim: true }],
        response_metadata: { next_cursor: '' },
      }),
    );
    const client = new SlackWebApiSyncClient({ token: 'xoxp-test', baseUrl: 'https://slack.test/api/', fetch: fetchMock as any });

    await expect(client.listUserConversations({ userId: 'U123', types: ['mpim'], limit: 100 })).resolves.toEqual({
      conversations: [{ id: 'GMP1', name: 'project-group', type: 'mpim' }],
    });

    expect(fetchMock).toHaveBeenCalledWith('https://slack.test/api/users.conversations', expect.anything());
    expect(getRequestBody(fetchMock).get('user')).toBe('U123');
    expect(getRequestBody(fetchMock).get('types')).toBe('mpim');
    expect(getRequestBody(fetchMock).get('exclude_archived')).toBe('true');
  });

  it('uses oldest as durable high-water input while cursors remain per-request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          messages: [{ ts: '1710000002.000000', user: 'U2', text: 'newer' }],
          response_metadata: { next_cursor: 'history-2' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          messages: [{ ts: '1710000001.000000', user: 'U1', text: 'older', thread_ts: '1710000000.000000' }],
          response_metadata: { next_cursor: '' },
        }),
      );
    const client = new SlackWebApiSyncClient({ token: 'xoxp-test', baseUrl: 'https://slack.test/api/', fetch: fetchMock as any });

    await expect(
      client.listMessages({
        conversation: { id: 'C1', name: 'general', type: 'public_channel' },
        oldest: '1710000000.000000',
        inclusive: false,
        limit: 50,
      }),
    ).resolves.toEqual({
      latestTs: '1710000002.000000',
      messages: [
        {
          channelId: 'C1',
          channelName: 'general',
          channelType: 'public_channel',
          ts: '1710000001.000000',
          threadTs: '1710000000.000000',
          user: 'U1',
          text: 'older',
        },
        {
          channelId: 'C1',
          channelName: 'general',
          channelType: 'public_channel',
          ts: '1710000002.000000',
          user: 'U2',
          text: 'newer',
        },
      ],
    });

    expect(getRequestBody(fetchMock).get('oldest')).toBe('1710000000.000000');
    expect(getRequestBody(fetchMock).get('inclusive')).toBe('false');
    expect(getRequestBody(fetchMock, 1).get('cursor')).toBe('history-2');
  });

  it('passes latest to conversations.history for bounded context reads', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        messages: [{ ts: '1710000001.000000', user: 'U1', text: 'target' }],
      }),
    );
    const client = new SlackWebApiSyncClient({ token: 'xoxp-test', baseUrl: 'https://slack.test/api/', fetch: fetchMock as any });

    await expect(
      client.listMessages({
        conversation: { id: 'C1', name: 'general', type: 'public_channel' },
        latest: '1710000001.000000',
        inclusive: true,
        limit: 3,
        maxPages: 1,
      }),
    ).resolves.toMatchObject({
      messages: [expect.objectContaining({ ts: '1710000001.000000', text: 'target' })],
    });

    expect(fetchMock).toHaveBeenCalledWith('https://slack.test/api/conversations.history', expect.anything());
    expect(getRequestBody(fetchMock).get('latest')).toBe('1710000001.000000');
    expect(getRequestBody(fetchMock).get('inclusive')).toBe('true');
  });

  it('reads thread replies with conversations.replies', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        messages: [
          { ts: '1710000001.000000', thread_ts: '1710000001.000000', user: 'U1', text: 'root' },
          { ts: '1710000002.000000', thread_ts: '1710000001.000000', user: 'U2', text: 'reply' },
        ],
      }),
    );
    const client = new SlackWebApiSyncClient({ token: 'xoxp-test', baseUrl: 'https://slack.test/api/', fetch: fetchMock as any });

    await expect(
      client.listThreadMessages({
        conversation: { id: 'C1', name: 'general', type: 'public_channel' },
        threadTs: '1710000001.000000',
      }),
    ).resolves.toEqual({
      messages: [
        expect.objectContaining({ ts: '1710000001.000000', text: 'root', threadTs: '1710000001.000000' }),
        expect.objectContaining({ ts: '1710000002.000000', text: 'reply', threadTs: '1710000001.000000' }),
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith('https://slack.test/api/conversations.replies', expect.anything());
    expect(getRequestBody(fetchMock).get('channel')).toBe('C1');
    expect(getRequestBody(fetchMock).get('ts')).toBe('1710000001.000000');
  });

  it('throws structured Slack API errors', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: false, error: 'missing_scope' }));
    const client = new SlackWebApiSyncClient({ token: 'xoxp-test', fetch: fetchMock as any });

    await expect(client.getWorkspace()).rejects.toMatchObject({
      name: 'SlackSignalsApiError',
      method: 'auth.test',
      code: 'missing_scope',
    });
  });

  it('throws structured HTTP errors', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'server_error' }, { status: 500 }));
    const client = new SlackWebApiSyncClient({ token: 'xoxp-test', fetch: fetchMock as any });

    await expect(client.getWorkspace()).rejects.toMatchObject({
      name: 'SlackSignalsApiError',
      method: 'auth.test',
      code: 'http_error',
      status: 500,
    });
  });

  it('retries 429 responses with Retry-After', async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: false, error: 'rate_limited' }, { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, team_id: 'T123' }));
    const client = new SlackWebApiSyncClient({ token: 'xoxp-test', fetch: fetchMock as any, sleep });

    await expect(client.getWorkspace()).resolves.toEqual({ teamId: 'T123' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(0);
  });

  it('exposes SlackSignalsApiError for instanceof checks', async () => {
    const error = new SlackSignalsApiError({ method: 'auth.test', code: 'missing_team_id' });

    expect(error).toBeInstanceOf(SlackSignalsApiError);
    expect(error.message).toContain('missing_team_id');
  });
});
