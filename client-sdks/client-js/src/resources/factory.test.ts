import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraClient } from '../client';

function mockFetch(...answers: Array<{ status?: number; body: unknown }>) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    const { status = 200, body } = answers.length > 1 ? answers.shift()! : answers[0]!;
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const wireCard = {
  id: 'w1',
  orgId: 'org',
  createdBy: 'u1',
  factoryProjectId: 'fp-1',
  externalSource: {
    integrationId: 'github',
    type: 'issue',
    externalId: 'acme/app#7',
    url: 'https://github.com/acme/app/issues/7',
  },
  parentWorkItemId: null,
  title: 'Fix it',
  stages: ['backlog'],
  stageHistory: [],
  sessions: {},
  metadata: null,
  revision: 1,
  createdAt: '2026-11-27T00:00:00.000Z',
  updatedAt: '2026-11-27T00:00:00.000Z',
};

describe('Factory resource', () => {
  const client = new MastraClient({ baseUrl: 'http://localhost:4111', retries: 0 });
  const urls = (fetchMock: ReturnType<typeof mockFetch>) => fetchMock.mock.calls.map(call => call[0]);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads under Factory's own routes by default and under a host's base path when given", async () => {
    const fetchMock = mockFetch({ body: { pending: [], running: [] } });
    await client.getFactory('fp 1').runQueue();
    await client.getFactory('fp-1', { basePath: '/v1/factory' }).runQueue();
    expect(urls(fetchMock)).toEqual([
      'http://localhost:4111/web/factory/projects/fp%201/run-queue',
      'http://localhost:4111/v1/factory/projects/fp-1/run-queue',
    ]);
  });

  it('asks for one board view with its parameters in one order, and reads its cards into the board shape', async () => {
    const fetchMock = mockFetch({
      body: { phases: [], boardTotal: 1, matchingTotal: 1, workItems: [{ ...wireCard, version: 'v1' }] },
    });
    const answer = await client.getFactory('fp-1').boardPhases(
      {
        board: 'work',
        sort: 'recent',
        q: 'crash',
        filters: { label: ['bug'], author: ['ana', 'bo'] },
        windows: { review: 100, build: 50 },
        item: 'w1',
      },
      { cards: true },
    );
    expect(urls(fetchMock)).toEqual([
      'http://localhost:4111/web/factory/projects/fp-1/boards/work/phases?sort=recent&q=crash&author=ana&author=bo&label=bug&window=build%3A50&window=review%3A100&item=w1&cards=true',
    ]);
    expect(answer.workItems?.[0]).toMatchObject({
      githubProjectId: 'fp-1',
      source: 'github-issue',
      sourceKey: 'acme/app#7',
      url: 'https://github.com/acme/app/issues/7',
      metadata: {},
      description: null,
      version: 'v1',
    });
  });

  it('never reads the whole project when a list asks for nothing', async () => {
    const fetchMock = mockFetch({ body: { workItems: [] } });
    expect(await client.getFactory('fp-1').listWorkItems({ workItemId: [] })).toEqual({ workItems: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers a move at once, as submitted, or as refused', async () => {
    const accepted = {
      status: 'accepted',
      transitionId: 't1',
      itemId: 'w1',
      revision: 2,
      stage: 'build',
      decisions: [],
    };
    const rejected = { status: 'rejected', transitionId: 't2', itemId: 'w1', code: 'stale_revision', reason: 'moved' };
    mockFetch(
      { body: { result: accepted } },
      { status: 202, body: { inputId: 'in-1' } },
      { status: 409, body: { result: rejected } },
    );
    const factory = client.getFactory('fp-1');
    const move = { board: 'work', stage: 'build', expectedRevision: 1, requestId: 'r', cause: 'drag' };
    expect(await factory.transitionWorkItem('w1', move)).toEqual(accepted);
    expect(await factory.transitionWorkItem('w1', move)).toEqual({ status: 'submitted', inputId: 'in-1' });
    expect(await factory.transitionWorkItem('w1', move)).toEqual(rejected);
  });

  it('throws a move the server failed without answering', async () => {
    mockFetch({ status: 500, body: { error: 'boom' } });
    await expect(
      client.getFactory('fp-1').transitionWorkItem('w1', {
        board: 'work',
        stage: 'build',
        expectedRevision: 1,
        requestId: 'r',
        cause: 'drag',
      }),
    ).rejects.toThrow(/boom/);
  });

  it('sends a new card with its provenance in the server vocabulary', async () => {
    const fetchMock = mockFetch({ body: { workItem: wireCard } });
    await client.getFactory('fp-1').createWorkItem({
      source: 'github-issue',
      sourceKey: 'acme/app#7',
      url: 'https://github.com/acme/app/issues/7',
      title: 'Fix it',
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(body).not.toHaveProperty('source');
    expect(body.externalSource).toMatchObject({ externalId: 'acme/app#7' });
  });

  it('pages decisions and acts on one', async () => {
    const fetchMock = mockFetch({ body: { decisions: [] } });
    const factory = client.getFactory('fp-1');
    await factory.decisions({ statuses: ['proposed', 'failed'], limit: 20 });
    await factory.actOnDecision('d/1', 'approve');
    expect(urls(fetchMock)).toEqual([
      'http://localhost:4111/web/factory/projects/fp-1/decisions?statuses=proposed%2Cfailed&limit=20',
      'http://localhost:4111/web/factory/projects/fp-1/decisions/d%2F1/approve',
    ]);
    expect(fetchMock.mock.calls[1]![1]!.method).toBe('POST');
  });

  it('patches and deletes cards outside the project path', async () => {
    const fetchMock = mockFetch({ body: { workItem: wireCard, ok: true } });
    const factory = client.getFactory('fp-1');
    await factory.updateWorkItem('w1', { title: 'Fixed' });
    await factory.deleteWorkItem('w1');
    expect(urls(fetchMock)).toEqual([
      'http://localhost:4111/web/factory/work-items/w1',
      'http://localhost:4111/web/factory/work-items/w1',
    ]);
  });

  it('pages audit events by actor and reads session activity', async () => {
    const fetchMock = mockFetch({ body: { events: [], actors: {} } });
    const factory = client.getFactory('fp-1');
    await factory.auditEvents({ actorIds: ['u1', 'u2'], before: 'c1', limit: 200 });
    await factory.sessionActivity();
    expect(urls(fetchMock)).toEqual([
      'http://localhost:4111/web/factory/projects/fp-1/audit?actorIds=u1%2Cu2&before=c1&limit=200',
      'http://localhost:4111/web/factory/projects/fp-1/session-activity',
    ]);
  });
});
