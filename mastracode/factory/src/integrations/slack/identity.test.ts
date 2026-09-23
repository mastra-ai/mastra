import { describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../base.js';
import { buildSlackIdentity } from './identity.js';

const ctx = {} as IntegrationContext;

interface MemberFixture {
  id: string;
  team_id?: string;
  name?: string;
  real_name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  is_app_user?: boolean;
  profile?: { real_name?: string; display_name?: string; email?: string };
}

function makeFetch(pages: Array<{ members: MemberFixture[]; next_cursor?: string; ok?: boolean }>) {
  return vi.fn(async () => {
    const next = pages.shift();
    if (!next) {
      return new Response(JSON.stringify({ ok: true, members: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = JSON.stringify({
      ok: next.ok ?? true,
      members: next.members,
      response_metadata: next.next_cursor ? { next_cursor: next.next_cursor } : undefined,
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
  });
}

describe('buildSlackIdentity', () => {
  it('paginates users.list and tags each with the workspace team id', async () => {
    const fetchImpl = makeFetch([
      {
        members: [
          { id: 'U1', team_id: 'T1', profile: { display_name: 'alice', email: 'alice@x.com' } },
          { id: 'U2', team_id: 'T1', profile: { display_name: 'bob' } },
        ],
        next_cursor: 'cur-1',
      },
      { members: [{ id: 'U3', team_id: 'T1', real_name: 'Carol' }] },
    ]);
    const identity = buildSlackIdentity({ botToken: () => 'xoxb-fake', fetchImpl: fetchImpl as unknown as typeof fetch });

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([
      { externalUserId: 'U1', label: 'alice', email: 'alice@x.com', installation: 'T1' },
      { externalUserId: 'U2', label: 'bob', installation: 'T1' },
      { externalUserId: 'U3', label: 'Carol', installation: 'T1' },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const calls = fetchImpl.mock.calls as unknown as Array<[URL | string, RequestInit]>;
    expect(String(calls[0]![0])).toContain('limit=200');
    expect(calls[0]![1]!.headers).toMatchObject({ authorization: 'Bearer xoxb-fake' });
    expect(String(calls[1]![0])).toContain('cursor=cur-1');
  });

  it('drops bots, deleted users, app users, and Slackbot', async () => {
    const fetchImpl = makeFetch([
      {
        members: [
          { id: 'U1', team_id: 'T1', real_name: 'Alice' },
          { id: 'USLACKBOT', team_id: 'T1', real_name: 'Slackbot' },
          { id: 'UBOT', team_id: 'T1', is_bot: true, real_name: 'RobotBot' },
          { id: 'UAPP', team_id: 'T1', is_app_user: true, real_name: 'App' },
          { id: 'UDEAD', team_id: 'T1', deleted: true, real_name: 'Zombie' },
        ],
      },
    ]);
    const identity = buildSlackIdentity({ botToken: () => 'xoxb', fetchImpl: fetchImpl as unknown as typeof fetch });
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });
    expect(accounts.map(a => a.externalUserId)).toEqual(['U1']);
  });

  it('returns empty when no bot token is configured', async () => {
    const fetchImpl = vi.fn();
    const identity = buildSlackIdentity({ botToken: () => undefined, fetchImpl: fetchImpl as unknown as typeof fetch });
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });
    expect(accounts).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('stops paging on a non-ok Slack response and returns what was collected', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            members: [{ id: 'U1', team_id: 'T1', real_name: 'Alice' }],
            response_metadata: { next_cursor: 'cur-1' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, error: 'ratelimited' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const identity = buildSlackIdentity({ botToken: () => 'xoxb', fetchImpl: fetchImpl as unknown as typeof fetch });

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([{ externalUserId: 'U1', label: 'Alice', installation: 'T1' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('filters by case-insensitive substring match', async () => {
    const fetchImpl = makeFetch([
      {
        members: [
          { id: 'U1', team_id: 'T1', real_name: 'Octocat' },
          { id: 'U2', team_id: 'T1', real_name: 'Monalisa' },
        ],
      },
    ]);
    const identity = buildSlackIdentity({ botToken: () => 'xoxb', fetchImpl: fetchImpl as unknown as typeof fetch });
    const filtered = await identity.listCandidateAccounts(ctx, { orgId: 'org-1', query: 'MONA' });
    expect(filtered.map(a => a.externalUserId)).toEqual(['U2']);
  });
});
