import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth } from '../../routes/test-utils';
import { createFactoryStorageForTests } from '../../storage/test-utils';
import type { FactoryStorageTestSeed } from '../../storage/test-utils';
import { buildLinearAgentTools } from './agent-tools';
import { LinearIntegration } from './integration';
import type { UpsertLinearConnectionInput } from './storage';

// A real integration instance backed by seeded `:memory:` storage. Only the
// network edges (GraphQL reads/writes, token refresh) are spied out, so the
// connection lifecycle, scope checks, and caches run the production paths.
let seed!: FactoryStorageTestSeed;
let linear!: LinearIntegration;
let projectLookupShouldFail = false;

const fetchLinearIssueDetail = vi.fn();
const createLinearIssueComment = vi.fn();
const refreshLinearAccessToken = vi.fn();

let PROJECT_ID = '';
const ORG_ID = 'org-1';

function requestContextFor(resourceId: string | undefined): RequestContext {
  const ctx = new RequestContext();
  if (resourceId !== undefined) {
    ctx.set('controller', { resourceId });
  }
  return ctx;
}

async function seedProject(): Promise<void> {
  const project = await seed.projects.create({
    orgId: ORG_ID,
    userId: 'user-1',
    input: { name: 'Acme app' },
  });
  PROJECT_ID = project.id;
}

function seedConnection(overrides: Partial<UpsertLinearConnectionInput> = {}): Promise<void> {
  return linear.upsertConnection({
    orgId: ORG_ID,
    userId: 'user-1',
    accessToken: 'linear-token',
    refreshToken: 'linear-refresh',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    scope: 'read,comments:create',
    workspaceName: 'Acme',
    workspaceUrlKey: 'acme',
    ...overrides,
  });
}

const issueDetail = {
  id: 'uuid-1',
  identifier: 'ENG-42',
  title: 'Fix intake sync',
  description: 'It syncs the wrong way.',
  url: 'https://linear.app/acme/issue/ENG-42',
  state: 'Todo',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: 'ada',
  team: 'ENG',
  labels: ['bug'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
  comments: [{ author: 'grace', body: 'Repro attached.', createdAt: '2026-07-01T12:00:00Z' }],
};

beforeEach(async () => {
  projectLookupShouldFail = false;
  PROJECT_ID = '';
  seed = await createFactoryStorageForTests();
  const getById = seed.projects.getById.bind(seed.projects);
  vi.spyOn(seed.projects, 'getById').mockImplementation(async input => {
    if (projectLookupShouldFail) throw new Error('connection refused');
    return getById(input);
  });
  linear = new LinearIntegration({ clientId: 'lin_client', clientSecret: 'lin_secret' });
  linear.initialize({
    storage: seed.integrations.forIntegration('linear'),
    projects: seed.projects,
    auth: fakeRouteAuth(),
  });
  vi.spyOn(linear.intake, 'getIssue').mockImplementation(input => {
    if (input.connection.type !== 'oauth') throw new Error('expected OAuth connection');
    return fetchLinearIssueDetail(input.connection.accessToken, input.issueId);
  });
  vi.spyOn(linear.intake, 'createComment').mockImplementation(input => {
    if (input.connection.type !== 'oauth') throw new Error('expected OAuth connection');
    return createLinearIssueComment(input.connection.accessToken, input.issueId, input.body);
  });
  vi.spyOn(linear, 'refreshAccessToken').mockImplementation(refreshLinearAccessToken);
  fetchLinearIssueDetail.mockReset();
  createLinearIssueComment.mockReset();
  refreshLinearAccessToken.mockReset();
});

describe('buildLinearAgentTools — exposure gating', () => {
  it('exposes the Linear tools when the project org has a Linear connection', async () => {
    await seedProject();
    await seedConnection();
    const tools = await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).toHaveProperty('linear_get_issue');
    expect(tools).toHaveProperty('linear_create_comment');
  });

  it('withholds linear_create_comment when the connection scope is read-only', async () => {
    await seedProject();
    await seedConnection({ scope: 'read' });
    const tools = await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).toHaveProperty('linear_get_issue');
    expect(tools).not.toHaveProperty('linear_create_comment');
  });

  it('treats legacy connections without a recorded scope as read-only', async () => {
    await seedProject();
    await seedConnection({ scope: null });
    const tools = await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).toHaveProperty('linear_get_issue');
    expect(tools).not.toHaveProperty('linear_create_comment');
  });

  it('exposes nothing when the org has not connected Linear', async () => {
    await seedProject();
    const tools = await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).toEqual({});
  });

  it('exposes nothing when the host runs without web auth', async () => {
    await seedProject();
    await seedConnection();
    linear.initialize({
      storage: seed.integrations.forIntegration('linear'),
      projects: seed.projects,
      auth: fakeRouteAuth({ enabled: false }),
    });
    const tools = await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).toEqual({});
  });

  it('exposes nothing for resources that are not factory projects', async () => {
    await seedConnection();
    const tools = await buildLinearAgentTools({
      linear,
      requestContext: requestContextFor('local-default'),
    });
    expect(tools).toEqual({});
  });

  it('exposes nothing when there is no controller context', async () => {
    const tools = await buildLinearAgentTools({ linear, requestContext: requestContextFor(undefined) });
    expect(tools).toEqual({});
  });

  it('does not cache a transient database failure as "not a project"', async () => {
    await seedProject();
    await seedConnection();

    projectLookupShouldFail = true;
    expect(await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) })).toEqual({});

    // Database recovers: the next request must retry the lookup and get tools.
    projectLookupShouldFail = false;
    const tools = await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).toHaveProperty('linear_get_issue');
  });

  it('sees a fresh connection immediately after cache invalidation', async () => {
    await seedProject();
    expect(await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) })).toEqual({});

    // Org connects Linear (upsert invalidates the cached connection check).
    await seedConnection();

    const tools = await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).toHaveProperty('linear_get_issue');
  });
});

describe('linear_get_issue — execute', () => {
  async function getTool() {
    await seedProject();
    await seedConnection();
    const tools = await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) });
    return tools.linear_get_issue!;
  }

  it('returns the full issue detail for an identifier', async () => {
    fetchLinearIssueDetail.mockResolvedValue(issueDetail);
    const tool = await getTool();
    const result = await (tool.execute as any)({ issue: ' ENG-42 ' });
    expect(fetchLinearIssueDetail).toHaveBeenCalledWith('linear-token', 'ENG-42');
    expect(result).toEqual(issueDetail);
  });

  it('returns a not-found error for unknown issues', async () => {
    fetchLinearIssueDetail.mockResolvedValue(null);
    const tool = await getTool();
    const result = await (tool.execute as any)({ issue: 'ENG-999' });
    expect(result).toEqual({ error: 'Linear issue "ENG-999" was not found in this workspace.' });
  });

  it('refreshes an expired token before fetching', async () => {
    await seedProject();
    await seedConnection({ expiresAt: new Date(Date.now() - 1000) });
    refreshLinearAccessToken.mockResolvedValue({
      accessToken: 'linear-token-2',
      refreshToken: 'linear-refresh-2',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    fetchLinearIssueDetail.mockResolvedValue(issueDetail);

    const tools = await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.linear_get_issue!.execute as any)({ issue: 'ENG-42' });

    expect(refreshLinearAccessToken).toHaveBeenCalledWith('linear-refresh');
    expect(fetchLinearIssueDetail).toHaveBeenCalledWith('linear-token-2', 'ENG-42');
    expect(result).toEqual(issueDetail);
  });

  it('surfaces reauth-required as a tool error instead of throwing', async () => {
    await seedProject();
    await seedConnection({ expiresAt: new Date(Date.now() - 1000), refreshToken: null });

    const tools = await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.linear_get_issue!.execute as any)({ issue: 'ENG-42' });

    expect(result).toEqual({
      error: 'Linear authorization expired. Reconnect Linear to keep syncing intake issues.',
    });
  });

  it('maps fetch failures to a tool error', async () => {
    fetchLinearIssueDetail.mockRejectedValue(new Error('Linear API request failed (502)'));
    const tool = await getTool();
    const result = await (tool.execute as any)({ issue: 'ENG-42' });
    expect(result).toEqual({ error: 'Failed to fetch Linear issue: Linear API request failed (502)' });
  });
});

describe('linear_create_comment — execute', () => {
  async function getTool() {
    await seedProject();
    await seedConnection();
    const tools = await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) });
    return tools.linear_create_comment!;
  }

  it('posts a comment and returns its URL', async () => {
    createLinearIssueComment.mockResolvedValue({
      id: 'comment-1',
      url: 'https://linear.app/acme/issue/ENG-42#comment-1',
    });
    const tool = await getTool();
    const result = await (tool.execute as any)({ issue: ' ENG-42 ', body: 'Investigated: root cause is X.' });
    expect(createLinearIssueComment).toHaveBeenCalledWith('linear-token', 'ENG-42', 'Investigated: root cause is X.');
    expect(result).toEqual({ posted: true, url: 'https://linear.app/acme/issue/ENG-42#comment-1' });
  });

  it('returns a not-found error for unknown issues', async () => {
    createLinearIssueComment.mockResolvedValue(null);
    const tool = await getTool();
    const result = await (tool.execute as any)({ issue: 'ENG-999', body: 'Hello' });
    expect(result).toEqual({ error: 'Linear issue "ENG-999" was not found in this workspace.' });
  });

  it('surfaces reauth-required as a tool error instead of throwing', async () => {
    await seedProject();
    await seedConnection({ expiresAt: new Date(Date.now() - 1000), refreshToken: null });

    const tools = await buildLinearAgentTools({ linear, requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.linear_create_comment!.execute as any)({ issue: 'ENG-42', body: 'Hello' });

    expect(result).toEqual({
      error: 'Linear authorization expired. Reconnect Linear to keep syncing intake issues.',
    });
  });

  it('maps post failures to a tool error', async () => {
    createLinearIssueComment.mockRejectedValue(new Error('Linear did not accept the comment.'));
    const tool = await getTool();
    const result = await (tool.execute as any)({ issue: 'ENG-42', body: 'Hello' });
    expect(result).toEqual({ error: 'Failed to post Linear comment: Linear did not accept the comment.' });
  });
});
