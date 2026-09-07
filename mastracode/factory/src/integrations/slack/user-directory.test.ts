import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SlackUserDirectory } from './user-directory.js';

const fetchMock = vi.fn<typeof fetch>();
const reply = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });
const auth = () => reply({ ok: true, team_id: 'T1', bot_id: 'B1' });
const page = (members: unknown[], cursor = '') =>
  reply({ ok: true, members, response_metadata: { next_cursor: cursor } });
const member = (id: string, name = 'caleb') => ({ id, name, profile: { display_name: name, real_name: name } });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('SlackUserDirectory', () => {
  it('paginates, deduplicates, filters non-humans, ranks normalized names and exposes only safe fields', async () => {
    fetchMock
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(
        page(
          [
            member('U3', 'other caleb'),
            member('U2', 'caleb barnes'),
            { ...member('UBOT'), is_bot: true },
            { ...member('UDEL'), deleted: true },
            { ...member('UAPP'), is_app_user: true },
            member('USLACKBOT'),
          ],
          'next',
        ),
      )
      .mockResolvedValueOnce(
        page([
          {
            ...member('U1', 'Caleb'),
            profile: { display_name: 'Caleb', real_name: 'Caleb Barnes', email: 'private@example.com' },
          },
          member('U2', 'caleb barnes'),
        ]),
      );
    const result = await new SlackUserDirectory('secret').find('T1', '  @CALEB  ');
    expect(result.candidates.map(user => user.id)).toEqual(['U1', 'U2', 'U3']);
    expect(result).toMatchObject({ totalMatches: 3, truncated: false, ambiguous: true });
    expect(result.candidates[0]).toEqual({
      id: 'U1',
      username: 'Caleb',
      displayName: 'Caleb',
      realName: 'Caleb Barnes',
      mention: '<@U1>',
    });
    expect(String(fetchMock.mock.calls[2]![0])).toContain('cursor=next');
    expect(JSON.stringify(result)).not.toContain('private@example.com');
  });

  it('matches real names with normalized whitespace and returns empty results', async () => {
    fetchMock
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(page([{ ...member('U1', 'cb'), real_name: 'Caleb Barnes', profile: null }]));
    const directory = new SlackUserDirectory('secret');
    expect((await directory.find('T1', 'caleb   barnes')).candidates[0]?.id).toBe('U1');
    expect(await directory.find('T1', 'nobody')).toEqual({
      candidates: [],
      totalMatches: 0,
      truncated: false,
      ambiguous: false,
    });
  });

  it('limits candidates without hiding ambiguity or total matches', async () => {
    fetchMock
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(page(Array.from({ length: 12 }, (_, i) => member(`U${i}`))));
    const result = await new SlackUserDirectory('secret').find('T1', 'caleb');
    expect(result.candidates).toHaveLength(10);
    expect(result).toMatchObject({ totalMatches: 12, truncated: true, ambiguous: true });
  });

  it('coalesces concurrent requests, caches for five minutes and isolates instances', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async url => (String(url).includes('auth.test') ? auth() : page([member('U1')])));
    const directory = new SlackUserDirectory('secret');
    await Promise.all([directory.find('T1', 'caleb'), directory.find('T1', 'ca')]);
    await directory.find('T1', 'caleb');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await new SlackUserDirectory('different-secret').find('T1', 'caleb');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(300_001);
    await directory.find('T1', 'caleb');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('rejects a different workspace before fetching a directory', async () => {
    fetchMock.mockResolvedValueOnce(auth());
    await expect(new SlackUserDirectory('secret').find('T2', 'caleb')).rejects.toThrow('not authorized');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['', '   ', '@', 'x'.repeat(201)])('rejects invalid query %j before network access', async query => {
    await expect(new SlackUserDirectory('secret').find('T1', query)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, error: 'missing_scope' }, 'users:read'],
    [{ ok: false, error: 'token_revoked' }, 'authentication failed'],
    [{ ok: false, error: 'private-secret-error' }, 'directory API failed'],
    [{ ok: true, members: {} }, 'Invalid Slack directory page'],
  ])('sanitizes errors and never caches partial pages: %j', async (failure, message) => {
    fetchMock
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(page([member('UPARTIAL')], 'next'))
      .mockResolvedValueOnce(reply(failure));
    const directory = new SlackUserDirectory('secret');
    await expect(directory.find('T1', 'caleb')).rejects.toThrow(message);
    fetchMock.mockImplementation(async url => (String(url).includes('auth.test') ? auth() : page([member('UFRESH')])));
    expect((await directory.find('T1', 'caleb')).candidates.map(user => user.id)).toEqual(['UFRESH']);
  });

  it('returns retry metadata on rate limiting without retrying automatically', async () => {
    fetchMock.mockResolvedValueOnce(auth()).mockResolvedValueOnce(reply({}, 429, { 'retry-after': '30' }));
    await expect(new SlackUserDirectory('secret').find('T1', 'caleb')).rejects.toMatchObject({
      retryable: true,
      retryAfterSeconds: 30,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects repeated cursors rather than serving a partial snapshot', async () => {
    fetchMock.mockResolvedValueOnce(auth()).mockImplementation(async () => page([member('U1')], 'repeat'));
    await expect(new SlackUserDirectory('secret').find('T1', 'caleb')).rejects.toThrow('pagination did not complete');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('sanitizes network and timeout failures and allows retry', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('secret-token'))
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(page([]));
    const directory = new SlackUserDirectory('secret');
    await expect(directory.find('T1', 'caleb')).rejects.toMatchObject({
      message: 'Slack directory request failed or timed out.',
      retryable: true,
    });
    expect((await directory.find('T1', 'caleb')).totalMatches).toBe(0);
  });
});
