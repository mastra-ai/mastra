import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

// Capture audit events at the store boundary so the real `emitAudit` path
// (actor resolution, request context, never-throws) is exercised end to end.
let auditRecorded: Array<Record<string, any>> = [];
let auditFailure: Error | undefined;

vi.mock('../audit/store', () => ({
  recordAuditEvent: async (input: any) => {
    if (auditFailure) throw auditFailure;
    auditRecorded.push(input);
    return {
      id: `00000000-0000-4000-9000-${String(auditRecorded.length).padStart(12, '0')}`,
      occurredAt: new Date(),
      ...input,
      githubProjectId: input.githubProjectId ?? null,
      metadata: input.metadata ?? {},
      context: input.context ?? {},
    };
  },
  listAuditEvents: async () => ({ events: [] }),
}));

import { GithubIntegration } from '../github/integration';
import { LinearIntegration } from '../linear/integration';
import { upsertLinearConnection } from '../linear/storage';
import { __resetRuntimeConfigForTests } from '../runtime-config';
import { handleServerError } from '../server-error';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base';
import { seedFactoryStorageForTests } from '../storage/test-utils';
import type { FactoryStorageTestSeed } from '../storage/test-utils';
import { mountApiRoutes } from '../test-utils';
import { buildFactoryRoutes } from './routes';
import type { FactoryRoutesDeps } from './routes';
import { parseCreateWorkItem, parseUpdateWorkItem } from './store';

// ── Test harness ─────────────────────────────────────────────────────────
let sourceControlStorage!: SourceControlStorageHandle;
let githubIntegration!: GithubIntegration;
let linearIntegration!: LinearIntegration;

interface ProviderOverrides {
  githubIntegration?: GithubIntegration | null;
  linearIntegration?: LinearIntegration | null;
  ensureGithubReady?: FactoryRoutesDeps['ensureGithubReady'];
  ensureLinearReady?: FactoryRoutesDeps['ensureLinearReady'];
}

function buildApp(
  user: { workosId: string; organizationId?: string } | null,
  storage: SourceControlStorageHandle | null = sourceControlStorage,
  overrides: ProviderOverrides = {},
) {
  const app = new Hono();
  app.onError(handleServerError);
  app.use('*', async (c, next) => {
    if (user) c.set('webAuthUser' as never, user as never);
    await next();
  });
  const github = overrides.githubIntegration === null ? undefined : (overrides.githubIntegration ?? githubIntegration);
  const linear = overrides.linearIntegration === null ? undefined : (overrides.linearIntegration ?? linearIntegration);
  mountApiRoutes(
    app as any,
    buildFactoryRoutes({
      ...(storage ? { sourceControlStorage: storage } : {}),
      ...(github ? { githubIntegration: github } : {}),
      ...(linear ? { linearIntegration: linear } : {}),
      ...(overrides.ensureGithubReady ? { ensureGithubReady: overrides.ensureGithubReady } : {}),
      ...(overrides.ensureLinearReady ? { ensureLinearReady: overrides.ensureLinearReady } : {}),
    }),
  );
  return app;
}

const orgUser = { workosId: 'u1', organizationId: 'org1' };
let PROJECT_ID = '';

async function seedProject(orgId = 'org1') {
  const project = await sourceControlStorage.projects.upsert({
    orgId,
    createdByUserId: 'u1',
    installationExternalId: '1',
    repositorySlug: `acme/${orgId}-app`,
    repositoryExternalId: orgId === 'org1' ? '1' : `1-${orgId}`,
    defaultBranch: 'main',
    sandboxProvider: 'local',
    sandboxWorkdir: '/tmp/acme-app',
  });
  PROJECT_ID = project.id;
}

const listItems = () => seed.workItems.list('org1', PROJECT_ID);

function json(method: string, path: string, body?: unknown, user: typeof orgUser | null = orgUser) {
  return buildApp(user).request(path, {
    method,
    ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
}

const createBody = (overrides: Record<string, unknown> = {}) => ({
  source: 'github-issue',
  sourceKey: 'github-issue:42',
  title: 'Fix the login flow',
  url: 'https://github.com/acme/app/issues/42',
  stages: ['intake'],
  metadata: { number: 42 },
  ...overrides,
});

let seed: FactoryStorageTestSeed;

beforeEach(async () => {
  seed = await seedFactoryStorageForTests();
  sourceControlStorage = seed.sourceControl.forIntegration('github');
  githubIntegration = new GithubIntegration({
    appId: '123',
    privateKey: 'test-private-key',
    clientId: 'github-client',
    clientSecret: 'github-secret',
    slug: 'test-app',
  });
  linearIntegration = new LinearIntegration({ clientId: 'linear-client', clientSecret: 'linear-secret' });
  auditRecorded = [];
  auditFailure = undefined;
  await seedProject();
});

afterEach(() => {
  __resetRuntimeConfigForTests();
  vi.clearAllMocks();
});

// ── Auth / scoping ───────────────────────────────────────────────────────
describe('auth and scoping', () => {
  it('401s without a user', async () => {
    const res = await json('GET', `/web/factory/repositories/${PROJECT_ID}/work-items`, undefined, null);
    expect(res.status).toBe(401);
  });

  it('403s without an organization', async () => {
    const res = await buildApp({ workosId: 'u1' }).request(`/web/factory/repositories/${PROJECT_ID}/work-items`);
    expect(res.status).toBe(403);
  });

  it('404s when the project belongs to another org', async () => {
    await seedProject('other-org');
    const res = await json('GET', `/web/factory/repositories/${PROJECT_ID}/work-items`);
    expect(res.status).toBe(404);
  });

  it('503s when GitHub storage is unavailable', async () => {
    const res = await buildApp(orgUser, null).request(`/web/factory/repositories/${PROJECT_ID}/work-items`);
    expect(res.status).toBe(503);
  });

  it('404s on a non-uuid project id', async () => {
    const res = await json('GET', `/web/factory/repositories/not-a-uuid/work-items`);
    expect(res.status).toBe(404);
  });

  it('is org-wide: another member of the same org sees the item', async () => {
    await json('POST', `/web/factory/repositories/${PROJECT_ID}/work-items`, createBody());
    const res = await buildApp({ workosId: 'u2', organizationId: 'org1' }).request(
      `/web/factory/repositories/${PROJECT_ID}/work-items`,
    );
    const body = await res.json();
    expect(body.workItems).toHaveLength(1);
    expect(body.workItems[0].createdBy).toBe('u1');
  });
});

// ── Thread task context ──────────────────────────────────────────────────
describe('GET /web/factory/repositories/:id/threads/:threadId/context', () => {
  async function createLinkedItem(threadId: string, overrides: Record<string, unknown> = {}) {
    const response = await json(
      'POST',
      `/web/factory/repositories/${PROJECT_ID}/work-items`,
      createBody({
        sessions: { work: { projectPath: `/workspace/${threadId}`, branch: `factory/${threadId}`, threadId } },
        ...overrides,
      }),
    );
    expect(response.status).toBe(200);
  }

  function requestContext(threadId: string, overrides: ProviderOverrides = {}) {
    return buildApp(orgUser, sourceControlStorage, overrides).request(
      `/web/factory/repositories/${PROJECT_ID}/threads/${encodeURIComponent(threadId)}/context`,
    );
  }

  async function connectLinear(overrides: {
    accessToken?: string;
    refreshToken?: string | null;
    expiresAt?: Date | null;
  } = {}) {
    await upsertLinearConnection({
      orgId: 'org1',
      userId: 'u1',
      accessToken: overrides.accessToken ?? 'linear-access-token',
      refreshToken: overrides.refreshToken ?? null,
      expiresAt: overrides.expiresAt ?? null,
      scope: 'read',
      workspaceName: 'Acme',
      workspaceUrlKey: 'acme',
    });
  }

  it('hydrates GitHub issues and pull requests with the scoped installation and repository', async () => {
    await createLinkedItem('issue-thread');
    await createLinkedItem('pr-thread', {
      source: 'github-pr',
      sourceKey: 'github-pr:77',
      title: 'Stored PR title',
      url: 'https://github.com/acme/org1-app/pull/77',
    });
    const issue = vi.spyOn(githubIntegration, 'getIssueDetail').mockResolvedValue({
      number: 42,
      title: 'Live issue title',
      description: 'Live **markdown** body',
      state: 'open',
      labels: ['bug'],
      assignees: ['octocat'],
      url: 'https://github.com/acme/org1-app/issues/42',
    });
    const pullRequest = vi.spyOn(githubIntegration, 'getPullRequestDetail').mockResolvedValue({
      number: 77,
      title: 'Live PR title',
      description: 'PR body',
      state: 'merged',
      labels: ['feature'],
      assignees: ['grace'],
      url: 'https://github.com/acme/org1-app/pull/77',
    });

    const issueResponse = await requestContext('issue-thread');
    const prResponse = await requestContext('pr-thread');

    expect(issueResponse.status).toBe(200);
    await expect(issueResponse.json()).resolves.toEqual({
      context: {
        task: {
          source: 'github-issue',
          identifier: '42',
          title: 'Live issue title',
          description: 'Live **markdown** body',
          state: 'open',
          labels: ['bug'],
          assignees: ['octocat'],
          url: 'https://github.com/acme/org1-app/issues/42',
        },
        resolution: { mode: 'live' },
      },
    });
    expect(prResponse.status).toBe(200);
    expect((await prResponse.json()).context.task).toMatchObject({
      source: 'github-pr',
      identifier: '77',
      title: 'Live PR title',
      state: 'merged',
    });
    expect(issue).toHaveBeenCalledWith(1, 'acme/org1-app', 42);
    expect(pullRequest).toHaveBeenCalledWith(1, 'acme/org1-app', 77);
  });

  it('hydrates a Linear issue with one lightweight provider read', async () => {
    await createLinkedItem('linear-thread', {
      source: 'linear-issue',
      sourceKey: 'linear:ENG-42',
      title: 'Stored Linear title',
      url: 'https://linear.app/acme/issue/ENG-42',
    });
    await connectLinear();
    const fetchIssue = vi.spyOn(linearIntegration, 'fetchIssueContext').mockResolvedValue({
      identifier: 'ENG-42',
      title: 'Live Linear title',
      description: 'Linear description',
      state: 'In Progress',
      labels: ['factory'],
      assignees: ['ada'],
      url: 'https://linear.app/acme/issue/ENG-42',
    });

    const response = await requestContext('linear-thread');

    expect(response.status).toBe(200);
    expect((await response.json()).context).toEqual({
      task: {
        source: 'linear-issue',
        identifier: 'ENG-42',
        title: 'Live Linear title',
        description: 'Linear description',
        state: 'In Progress',
        labels: ['factory'],
        assignees: ['ada'],
        url: 'https://linear.app/acme/issue/ENG-42',
      },
      resolution: { mode: 'live' },
    });
    expect(fetchIssue).toHaveBeenCalledWith('linear-access-token', 'ENG-42');
  });

  it('returns null for an unlinked thread and 409 for ambiguous linkage', async () => {
    const unlinked = await requestContext('unlinked-thread');
    expect(unlinked.status).toBe(200);
    await expect(unlinked.json()).resolves.toEqual({ context: null });

    await createLinkedItem('ambiguous-thread');
    await createLinkedItem('ambiguous-thread', { sourceKey: 'github-issue:43' });
    const ambiguous = await requestContext('ambiguous-thread');
    expect(ambiguous.status).toBe(409);
    await expect(ambiguous.json()).resolves.toEqual({
      error: 'ambiguous_thread_context',
      message: 'Multiple work items reference this thread.',
    });
  });

  it('uses stored context for manual and malformed source identities without provider calls', async () => {
    const issue = vi.spyOn(githubIntegration, 'getIssueDetail');
    const pullRequest = vi.spyOn(githubIntegration, 'getPullRequestDetail');
    const linear = vi.spyOn(linearIntegration, 'fetchIssueContext');

    await seed.workItems.upsert({
      orgId: 'org1',
      userId: 'u1',
      githubProjectId: PROJECT_ID,
      input: {
        source: 'manual',
        sourceKey: null,
        title: 'Manual task',
        url: 'javascript:alert(1)',
        stages: ['intake'],
        sessions: {
          work: { projectPath: '/workspace/manual-thread', branch: 'factory/manual-thread', threadId: 'manual-thread' },
        },
        metadata: {},
      },
    });
    const manual = await requestContext('manual-thread');
    expect((await manual.json()).context).toEqual({
      task: { source: 'manual', title: 'Manual task', labels: [], assignees: [] },
      resolution: { mode: 'stored', reason: 'manual' },
    });

    const invalid = [
      ['github-issue', 'github-issue:0'],
      ['github-issue', 'github-issue:042'],
      ['github-pr', 'github-issue:42'],
      ['linear-issue', 'linear:eng-42'],
      ['linear-issue', 'linear: ENG-42'],
      ['linear-issue', `linear:${'A'.repeat(129)}`],
    ] as const;
    for (const [index, [source, sourceKey]] of invalid.entries()) {
      const threadId = `invalid-${index}`;
      await createLinkedItem(threadId, { source, sourceKey, title: `Stored ${index}` });
      const response = await requestContext(threadId);
      expect((await response.json()).context.resolution).toEqual({ mode: 'stored', reason: 'invalid-source' });
    }

    expect(issue).not.toHaveBeenCalled();
    expect(pullRequest).not.toHaveBeenCalled();
    expect(linear).not.toHaveBeenCalled();
  });

  it('degrades provider absence, disconnect, reauth, not-found, and provider failures to stored context', async () => {
    await createLinkedItem('github-missing', { url: 'https://github.com/acme/org1-app/issues/42' });
    const githubMissing = await requestContext('github-missing', { githubIntegration: null });
    expect((await githubMissing.json()).context.resolution).toEqual({
      mode: 'stored',
      reason: 'provider-unavailable',
    });

    await createLinkedItem('github-not-found', { sourceKey: 'github-issue:43' });
    vi.spyOn(githubIntegration, 'getIssueDetail').mockResolvedValueOnce(null);
    const githubNotFound = await requestContext('github-not-found');
    expect((await githubNotFound.json()).context.resolution).toEqual({ mode: 'stored', reason: 'not-found' });

    await createLinkedItem('github-error', { sourceKey: 'github-issue:44' });
    vi.spyOn(githubIntegration, 'getIssueDetail').mockRejectedValueOnce(new Error('provider token must not leak'));
    const githubError = await requestContext('github-error');
    const githubErrorBody = await githubError.json();
    expect(githubErrorBody.context.resolution).toEqual({ mode: 'stored', reason: 'provider-unavailable' });
    expect(JSON.stringify(githubErrorBody)).not.toContain('provider token must not leak');

    await createLinkedItem('linear-disconnected', {
      source: 'linear-issue',
      sourceKey: 'linear:ENG-42',
      title: 'Stored Linear title',
    });
    const disconnected = await requestContext('linear-disconnected');
    expect((await disconnected.json()).context.resolution).toEqual({ mode: 'stored', reason: 'not-connected' });

    await connectLinear({ expiresAt: new Date(Date.now() - 120_000) });
    const reauth = await requestContext('linear-disconnected');
    expect((await reauth.json()).context.resolution).toEqual({ mode: 'stored', reason: 'reauth-required' });

    await connectLinear({ refreshToken: 'refresh-token', expiresAt: new Date(Date.now() - 120_000) });
    vi.spyOn(linearIntegration, 'refreshAccessToken').mockRejectedValueOnce(
      Object.assign(new Error('upstream token secret'), { status: 503 }),
    );
    const unavailable = await requestContext('linear-disconnected');
    const unavailableBody = await unavailable.json();
    expect(unavailableBody.context.resolution).toEqual({ mode: 'stored', reason: 'provider-unavailable' });
    expect(JSON.stringify(unavailableBody)).not.toContain('upstream token secret');
  });

  it('keeps integration storage readiness failures on the normal 500 path', async () => {
    await createLinkedItem('github-readiness');
    const issue = vi.spyOn(githubIntegration, 'getIssueDetail');
    const githubFailure = await requestContext('github-readiness', {
      ensureGithubReady: vi.fn().mockRejectedValue(new Error('github storage initialization failed')),
    });
    expect(githubFailure.status).toBe(500);
    expect(issue).not.toHaveBeenCalled();

    await createLinkedItem('linear-readiness', {
      source: 'linear-issue',
      sourceKey: 'linear:ENG-42',
      title: 'Stored Linear title',
    });
    await connectLinear();
    const linear = vi.spyOn(linearIntegration, 'fetchIssueContext');
    const linearFailure = await requestContext('linear-readiness', {
      ensureLinearReady: vi.fn().mockRejectedValue(new Error('linear storage initialization failed')),
    });
    expect(linearFailure.status).toBe(500);
    expect(linear).not.toHaveBeenCalled();
  });

  it('keeps connection storage and mapping failures on the normal 500 path', async () => {
    await createLinkedItem('linear-storage', {
      source: 'linear-issue',
      sourceKey: 'linear:ENG-42',
      title: 'Stored Linear title',
    });
    const realLinearStorage = seed.integrations.forIntegration('linear');
    vi.spyOn(seed.integrations, 'forIntegration').mockReturnValue({
      ...realLinearStorage,
      connections: {
        ...realLinearStorage.connections,
        get: vi.fn().mockRejectedValue(new Error('connection storage unavailable')),
      },
    } as never);

    const storageFailure = await requestContext('linear-storage');
    expect(storageFailure.status).toBe(500);

    vi.restoreAllMocks();
    await connectLinear();
    vi.spyOn(linearIntegration, 'fetchIssueContext').mockResolvedValue({
      identifier: 'ENG-42',
      get title(): string {
        throw new Error('mapping bug');
      },
      state: 'open',
      labels: [],
      assignees: [],
    });
    const mappingFailure = await requestContext('linear-storage');
    expect(mappingFailure.status).toBe(500);
  });

  it('fails with 500 when a rotated Linear token cannot be persisted or the connection disappears', async () => {
    await createLinkedItem('linear-refresh', {
      source: 'linear-issue',
      sourceKey: 'linear:ENG-42',
      title: 'Stored Linear title',
    });
    await connectLinear({ refreshToken: 'refresh-token', expiresAt: new Date(Date.now() - 120_000) });
    const realLinearStorage = seed.integrations.forIntegration('linear');
    vi.spyOn(seed.integrations, 'forIntegration').mockReturnValue({
      ...realLinearStorage,
      connections: {
        ...realLinearStorage.connections,
        update: vi.fn().mockRejectedValue(new Error('token persistence failed')),
      },
    } as never);
    vi.spyOn(linearIntegration, 'refreshAccessToken').mockResolvedValue({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
      expiresAt: new Date(Date.now() + 3_600_000),
      scope: 'read',
    });
    const fetchIssue = vi.spyOn(linearIntegration, 'fetchIssueContext');

    const persistenceFailure = await requestContext('linear-refresh');
    expect(persistenceFailure.status).toBe(500);
    expect(fetchIssue).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    await connectLinear({ refreshToken: 'refresh-token-2', expiresAt: new Date(Date.now() - 120_000) });
    const storage = seed.integrations.forIntegration('linear');
    vi.spyOn(linearIntegration, 'refreshAccessToken').mockImplementationOnce(async () => {
      await storage.connections.delete('org1');
      return {
        accessToken: 'orphaned-access-token',
        refreshToken: 'orphaned-refresh-token',
        expiresAt: new Date(Date.now() + 3_600_000),
        scope: 'read',
      };
    });
    const fetchAfterDelete = vi.spyOn(linearIntegration, 'fetchIssueContext');

    const disappeared = await requestContext('linear-refresh');
    expect(disappeared.status).toBe(500);
    expect(fetchAfterDelete).not.toHaveBeenCalled();
  });

  it('retains tenant, repository, input, and work-item storage failures as route errors', async () => {
    const wrongOrg = await seedProject('other-org');
    const crossOrg = await buildApp(orgUser).request(
      `/web/factory/repositories/${PROJECT_ID}/threads/thread/context`,
    );
    expect(wrongOrg).toBeUndefined();
    expect(crossOrg.status).toBe(404);

    await seedProject('org1');
    const invalid = await buildApp(orgUser).request(
      `/web/factory/repositories/${PROJECT_ID}/threads/${'x'.repeat(1_025)}/context`,
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: 'invalid_thread_id' });

    vi.spyOn(seed.workItems, 'findByThreadId').mockRejectedValueOnce(new Error('work-item storage failed'));
    const storageFailure = await requestContext('storage-error');
    expect(storageFailure.status).toBe(500);
  });
});

// ── Create / upsert ──────────────────────────────────────────────────────
describe('POST /web/factory/repositories/:id/work-items', () => {
  it('creates a work item with server-stamped history', async () => {
    const res = await json('POST', `/web/factory/repositories/${PROJECT_ID}/work-items`, createBody());
    expect(res.status).toBe(200);
    const { workItem } = await res.json();
    expect(workItem).toMatchObject({
      orgId: 'org1',
      createdBy: 'u1',
      githubProjectId: PROJECT_ID,
      source: 'github-issue',
      sourceKey: 'github-issue:42',
      title: 'Fix the login flow',
      stages: ['intake'],
      metadata: { number: 42 },
    });
    expect(workItem.stageHistory).toHaveLength(1);
    expect(workItem.stageHistory[0]).toMatchObject({ stage: 'intake', by: 'u1' });
    expect(workItem.stageHistory[0].enteredAt).toBeTruthy();
    expect(workItem.stageHistory[0].exitedAt).toBeUndefined();
  });

  it('upserts on sourceKey instead of duplicating', async () => {
    await json('POST', `/web/factory/repositories/${PROJECT_ID}/work-items`, createBody());
    const res = await json(
      'POST',
      `/web/factory/repositories/${PROJECT_ID}/work-items`,
      createBody({
        stages: ['execute'],
        sessions: { work: { projectPath: '/sb/wt/issue-42', branch: 'factory/issue-42', threadId: 't-1' } },
      }),
    );
    const { workItem } = await res.json();
    expect(await listItems()).toHaveLength(1);
    expect(workItem.stages).toEqual(['execute']);
    // History: intake entered+exited, execute entered.
    expect(workItem.stageHistory.map((e: any) => [e.stage, e.exitedAt !== undefined])).toEqual([
      ['intake', true],
      ['execute', false],
    ]);
    // Session got the acting user stamped server-side.
    expect(workItem.sessions.work).toMatchObject({
      projectPath: '/sb/wt/issue-42',
      branch: 'factory/issue-42',
      threadId: 't-1',
      startedBy: 'u1',
    });
  });

  it('never dedupes manual cards (null sourceKey)', async () => {
    await json(
      'POST',
      `/web/factory/repositories/${PROJECT_ID}/work-items`,
      createBody({ source: 'manual', sourceKey: null }),
    );
    await json(
      'POST',
      `/web/factory/repositories/${PROJECT_ID}/work-items`,
      createBody({ source: 'manual', sourceKey: null }),
    );
    expect(await listItems()).toHaveLength(2);
  });

  it('400s on an invalid body', async () => {
    const res = await json('POST', `/web/factory/repositories/${PROJECT_ID}/work-items`, createBody({ stages: [] }));
    expect(res.status).toBe(400);
    const bad = await json(
      'POST',
      `/web/factory/repositories/${PROJECT_ID}/work-items`,
      createBody({ source: 'jira' }),
    );
    expect(bad.status).toBe(400);
  });
});

// ── Patch ────────────────────────────────────────────────────────────────
describe('PATCH /web/factory/work-items/:id', () => {
  async function createItem(overrides: Record<string, unknown> = {}) {
    const res = await json('POST', `/web/factory/repositories/${PROJECT_ID}/work-items`, createBody(overrides));
    return (await res.json()).workItem;
  }

  it('moves stages and appends history with the acting user', async () => {
    const item = await createItem();
    const res = await buildApp({ workosId: 'u2', organizationId: 'org1' }).request(
      `/web/factory/work-items/${item.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stages: ['execute'] }),
      },
    );
    const { workItem } = await res.json();
    expect(workItem.stages).toEqual(['execute']);
    expect(workItem.stageHistory).toHaveLength(2);
    expect(workItem.stageHistory[0]).toMatchObject({ stage: 'intake', by: 'u1' });
    expect(workItem.stageHistory[0].exitedAt).toBeTruthy();
    expect(workItem.stageHistory[1]).toMatchObject({ stage: 'execute', by: 'u2' });
  });

  it('keeps concurrent stages untouched when moving one of them', async () => {
    const item = await createItem({ stages: ['execute', 'review'] });
    const res = await json('PATCH', `/web/factory/work-items/${item.id}`, { stages: ['done'] });
    const { workItem } = await res.json();
    expect(workItem.stages).toEqual(['done']);
    const open = workItem.stageHistory.filter((e: any) => e.exitedAt === undefined);
    expect(open.map((e: any) => e.stage)).toEqual(['done']);
  });

  it('merges sessions and metadata instead of replacing', async () => {
    const item = await createItem({
      sessions: { work: { projectPath: '/sb/wt/a', branch: 'b-a', threadId: 't-a' } },
      metadata: { number: 42, labels: ['bug'] },
    });
    const res = await json('PATCH', `/web/factory/work-items/${item.id}`, {
      sessions: { review: { projectPath: '/sb/wt/r', branch: 'b-r', threadId: 't-r' } },
      metadata: { prNumber: 7 },
    });
    const { workItem } = await res.json();
    expect(Object.keys(workItem.sessions).sort()).toEqual(['review', 'work']);
    expect(workItem.metadata).toEqual({ number: 42, labels: ['bug'], prNumber: 7 });
  });

  it('serializes concurrent patches so neither session merge is dropped', async () => {
    const item = await createItem();
    // Two runs file their session refs on the same card at once (e.g. a work
    // run and a review run finishing kickoff together). Each merge reads the
    // current `sessions` and writes it back — without the row lock the last
    // write would silently drop the other role.
    const [workRes, reviewRes] = await Promise.all([
      json('PATCH', `/web/factory/work-items/${item.id}`, {
        sessions: { work: { projectPath: '/sb/wt/a', branch: 'b-a', threadId: 't-a' } },
      }),
      json('PATCH', `/web/factory/work-items/${item.id}`, {
        sessions: { review: { projectPath: '/sb/wt/r', branch: 'b-r', threadId: 't-r' } },
      }),
    ]);
    expect(workRes.status).toBe(200);
    expect(reviewRes.status).toBe(200);

    const list = await json('GET', `/web/factory/repositories/${PROJECT_ID}/work-items`);
    const [workItem] = (await list.json()).workItems;
    expect(Object.keys(workItem.sessions).sort()).toEqual(['review', 'work']);
  });

  it('404s for items in another org', async () => {
    const item = await createItem();
    const res = await buildApp({ workosId: 'u9', organizationId: 'org2' }).request(
      `/web/factory/work-items/${item.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stages: ['done'] }),
      },
    );
    expect(res.status).toBe(404);
  });

  it('400s on an empty or invalid patch', async () => {
    const item = await createItem();
    expect((await json('PATCH', `/web/factory/work-items/${item.id}`, {})).status).toBe(400);
    expect((await json('PATCH', `/web/factory/work-items/${item.id}`, { title: '' })).status).toBe(400);
  });
});

// ── Delete ───────────────────────────────────────────────────────────────
describe('DELETE /web/factory/work-items/:id', () => {
  it('removes the item for the org', async () => {
    const created = await json('POST', `/web/factory/repositories/${PROJECT_ID}/work-items`, createBody());
    const { workItem } = await created.json();
    const res = await json('DELETE', `/web/factory/work-items/${workItem.id}`);
    expect((await res.json()).ok).toBe(true);
    expect(await listItems()).toHaveLength(0);
  });

  it('404s for unknown or cross-org items', async () => {
    expect((await json('DELETE', `/web/factory/work-items/00000000-0000-4000-8000-000000000099`)).status).toBe(404);
  });
});

// ── Metrics ──────────────────────────────────────────────────────────────
describe('GET /web/factory/repositories/:id/metrics', () => {
  it('401s without a user and 404s for projects outside the org', async () => {
    expect((await json('GET', `/web/factory/repositories/${PROJECT_ID}/metrics`, undefined, null)).status).toBe(401);

    await seedProject('other-org');
    expect((await json('GET', `/web/factory/repositories/${PROJECT_ID}/metrics`)).status).toBe(404);
  });

  it('clamps the days param to a supported window', async () => {
    const bodyFor = async (query: string) =>
      (await (await json('GET', `/web/factory/repositories/${PROJECT_ID}/metrics${query}`)).json()).metrics;

    expect((await bodyFor('')).windowDays).toBe(30);
    expect((await bodyFor('?days=7')).windowDays).toBe(7);
    expect((await bodyFor('?days=90')).windowDays).toBe(90);
    expect((await bodyFor('?days=17')).windowDays).toBe(30);
    expect((await bodyFor('?days=evil')).windowDays).toBe(30);
  });

  it('aggregates the project board: throughput, WIP, transitions, and source mix', async () => {
    // One card completed today (intake → done), one still in intake.
    const created = await json('POST', `/web/factory/repositories/${PROJECT_ID}/work-items`, createBody());
    const { workItem } = await created.json();
    await json('PATCH', `/web/factory/work-items/${workItem.id}`, { stages: ['done'] });
    await json(
      'POST',
      `/web/factory/repositories/${PROJECT_ID}/work-items`,
      createBody({ source: 'manual', sourceKey: null, title: 'Manual card' }),
    );

    const res = await json('GET', `/web/factory/repositories/${PROJECT_ID}/metrics?days=7`);
    expect(res.status).toBe(200);
    const { metrics } = await res.json();

    expect(metrics.windowDays).toBe(7);
    expect(metrics.throughput).toHaveLength(7);
    expect(metrics.throughput.reduce((sum: number, p: any) => sum + p.count, 0)).toBe(1);
    expect(metrics.cycleTime.samples).toBe(1);
    expect(Object.fromEntries(metrics.wip.map((w: any) => [w.stage, w.count]))).toEqual({ done: 1, intake: 1 });
    expect(metrics.wipTotal).toBe(1);
    expect(metrics.agingWip).toHaveLength(1);
    expect(metrics.agingWip[0]).toMatchObject({ title: 'Manual card', stage: 'intake' });
    // intake entered (x2) + done entered = 3 stage moves, all by the test user.
    expect(metrics.transitions).toEqual({ human: 3, total: 3 });
    expect(metrics.sourceMix).toEqual(
      expect.arrayContaining([
        { source: 'github-issue', count: 1 },
        { source: 'manual', count: 1 },
      ]),
    );
  });

  it('returns zeroed metrics for an empty board', async () => {
    const res = await json('GET', `/web/factory/repositories/${PROJECT_ID}/metrics`);
    const { metrics } = await res.json();
    expect(metrics.throughput).toHaveLength(30);
    expect(metrics.cycleTime).toEqual({ medianMs: null, p90Ms: null, samples: 0 });
    expect(metrics.wip).toEqual([]);
    expect(metrics.agingWip).toEqual([]);
  });
});

describe('GET /web/factory/repositories/:id/health/thresholds', () => {
  it('401s without a user and 404s for projects outside the org', async () => {
    expect(
      (await json('GET', `/web/factory/repositories/${PROJECT_ID}/health/thresholds`, undefined, null)).status,
    ).toBe(401);

    await seedProject('other-org');
    expect((await json('GET', `/web/factory/repositories/${PROJECT_ID}/health/thresholds`)).status).toBe(404);
  });

  it('returns the default config when unset and the saved config after saveConfig', async () => {
    const res = await json('GET', `/web/factory/repositories/${PROJECT_ID}/health/thresholds`);
    expect(res.status).toBe(200);
    expect((await res.json()).thresholds).toEqual([14400, 86400, 259200]);

    await seed.queueHealth.saveConfig('org1', PROJECT_ID, { thresholdsSeconds: [60, 300, 3600] });
    const res2 = await json('GET', `/web/factory/repositories/${PROJECT_ID}/health/thresholds`);
    expect((await res2.json()).thresholds).toEqual([60, 300, 3600]);
  });
});

// ── Audit events ─────────────────────────────────────────────────────────
describe('audit events', () => {
  async function createItem(overrides: Record<string, unknown> = {}) {
    const res = await json('POST', `/web/factory/repositories/${PROJECT_ID}/work-items`, createBody(overrides));
    return (await res.json()).workItem;
  }

  it('records work_item.created on POST with actor, project, and target', async () => {
    const item = await createItem();
    expect(auditRecorded).toHaveLength(1);
    expect(auditRecorded[0]).toMatchObject({
      orgId: 'org1',
      actorId: 'u1',
      action: 'factory.work_item.created',
      githubProjectId: PROJECT_ID,
      targets: [{ type: 'work_item', id: item.id, name: 'Fix the login flow' }],
      metadata: { source: 'github-issue', sourceKey: 'github-issue:42', stages: ['intake'] },
    });
  });

  it('records updated (not created) when a POST reuses an existing sourceKey', async () => {
    const item = await createItem();
    auditRecorded = [];

    const session = { projectPath: '/sb/wt/issue-42', branch: 'factory/issue-42', threadId: 't-1' };
    await json(
      'POST',
      `/web/factory/repositories/${PROJECT_ID}/work-items`,
      createBody({ stages: ['execute'], sessions: { work: session } }),
    );
    expect(auditRecorded.map(e => e.action)).toEqual([
      'factory.work_item.updated',
      'factory.work_item.stage_moved',
      'factory.run.started',
    ]);
    expect(auditRecorded[1]).toMatchObject({
      targets: [{ type: 'work_item', id: item.id, name: 'Fix the login flow' }],
      metadata: { from: ['intake'], to: ['execute'] },
    });
    expect(auditRecorded[2].metadata).toMatchObject({ role: 'work', branch: 'factory/issue-42' });
  });

  it('records updated + stage_moved with the server-diffed from/to on a stage PATCH', async () => {
    const item = await createItem();
    auditRecorded = [];

    await json('PATCH', `/web/factory/work-items/${item.id}`, { stages: ['execute'] });
    expect(auditRecorded.map(e => e.action)).toEqual(['factory.work_item.updated', 'factory.work_item.stage_moved']);
    expect(auditRecorded[0].metadata).toEqual({ fields: ['stages'] });
    expect(auditRecorded[1]).toMatchObject({
      githubProjectId: PROJECT_ID,
      targets: [{ type: 'work_item', id: item.id, name: 'Fix the login flow' }],
      metadata: { from: ['intake'], to: ['execute'] },
    });
  });

  it('records run.started when a PATCH introduces a new session role, but not on re-file', async () => {
    const item = await createItem();
    auditRecorded = [];

    const session = { projectPath: '/sb/wt/issue-42', branch: 'factory/issue-42', threadId: 't-1' };
    await json('PATCH', `/web/factory/work-items/${item.id}`, { sessions: { work: session } });
    expect(auditRecorded.map(e => e.action)).toEqual(['factory.work_item.updated', 'factory.run.started']);
    expect(auditRecorded[1].metadata).toEqual({
      role: 'work',
      branch: 'factory/issue-42',
      threadId: 't-1',
      projectPath: '/sb/wt/issue-42',
    });

    // Re-filing the same role is not a new run.
    auditRecorded = [];
    await json('PATCH', `/web/factory/work-items/${item.id}`, { sessions: { work: session } });
    expect(auditRecorded.map(e => e.action)).toEqual(['factory.work_item.updated']);
  });

  it('records only updated when the patch does not move stages', async () => {
    const item = await createItem();
    auditRecorded = [];

    await json('PATCH', `/web/factory/work-items/${item.id}`, { title: 'Renamed card' });
    expect(auditRecorded.map(e => e.action)).toEqual(['factory.work_item.updated']);
    expect(auditRecorded[0].metadata).toEqual({ fields: ['title'] });
  });

  it('records work_item.deleted on DELETE', async () => {
    const item = await createItem();
    auditRecorded = [];

    await json('DELETE', `/web/factory/work-items/${item.id}`);
    expect(auditRecorded).toHaveLength(1);
    expect(auditRecorded[0]).toMatchObject({
      action: 'factory.work_item.deleted',
      githubProjectId: PROJECT_ID,
      targets: [{ type: 'work_item', id: item.id, name: 'Fix the login flow' }],
    });
  });

  it('never blocks the mutation when the audit insert throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    auditFailure = new Error('audit db down');

    const created = await json('POST', `/web/factory/repositories/${PROJECT_ID}/work-items`, createBody());
    expect(created.status).toBe(200);
    const { workItem } = await created.json();

    const patched = await json('PATCH', `/web/factory/work-items/${workItem.id}`, { stages: ['done'] });
    expect(patched.status).toBe(200);

    const deleted = await json('DELETE', `/web/factory/work-items/${workItem.id}`);
    expect(deleted.status).toBe(200);
    expect(await listItems()).toHaveLength(0);

    warn.mockRestore();
  });
});

// ── Validation units ─────────────────────────────────────────────────────
describe('parseCreateWorkItem', () => {
  it('accepts a minimal valid body and defaults sessions/metadata', () => {
    const input = parseCreateWorkItem({ source: 'manual', title: 'Card', stages: ['intake'] });
    expect(input).toEqual({
      source: 'manual',
      sourceKey: null,
      title: 'Card',
      url: null,
      stages: ['intake'],
      sessions: {},
      metadata: {},
    });
  });

  it('rejects bad stages, urls, and oversized metadata', () => {
    expect(parseCreateWorkItem(createBody({ stages: ['in take'] }))).toBeNull();
    expect(parseCreateWorkItem(createBody({ stages: ['a', 'a'] }))).toBeNull();
    expect(parseCreateWorkItem(createBody({ url: 'javascript:alert(1)' }))).toBeNull();
    expect(parseCreateWorkItem(createBody({ metadata: { blob: 'x'.repeat(20_000) } }))).toBeNull();
  });

  it('rejects malformed sessions', () => {
    expect(parseCreateWorkItem(createBody({ sessions: { work: { projectPath: '/p' } } }))).toBeNull();
    expect(
      parseCreateWorkItem(createBody({ sessions: { 'bad role!': { projectPath: '/p', branch: 'b', threadId: 't' } } })),
    ).toBeNull();
  });
});

describe('parseUpdateWorkItem', () => {
  it('rejects an empty patch and passes through valid fields', () => {
    expect(parseUpdateWorkItem({})).toBeNull();
    expect(parseUpdateWorkItem({ stages: ['done'] })).toEqual({ stages: ['done'] });
    expect(parseUpdateWorkItem({ url: null })).toEqual({ url: null });
  });
});
