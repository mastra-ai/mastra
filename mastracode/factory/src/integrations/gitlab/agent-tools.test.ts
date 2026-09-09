/* eslint-disable @typescript-eslint/no-explicit-any -- tool.execute is invoked directly, bypassing the agent's typed call site. */
import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../../storage/test-utils.js';
import { buildGitlabAgentTools } from './agent-tools.js';
import { GitLabIntegration } from './integration.js';

// A real integration over seeded `:memory:` storage: only the GitLab HTTP edge
// is stubbed, so credential resolution, gating, and the project→org cache all
// run production code.
let seed!: FactoryStorageTestSeed;
let gitlab!: GitLabIntegration;
let projectLookupShouldFail = false;
let PROJECT_ID = '';
const ORG_ID = 'org1';

const getIssue = vi.fn();
const createIssueNote = vi.fn();

const ISSUE = {
  id: 9,
  iid: 7,
  project_id: 42,
  title: 'Widget explodes',
  description: 'It explodes.',
  state: 'opened' as const,
  web_url: 'https://gitlab.example.com/acme/app/-/issues/7',
  references: { full: 'acme/app#7' },
  author: { username: 'reporter' },
  assignees: [],
  labels: ['bug'],
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

function requestContextFor(resourceId: string | undefined, factoryProjectId?: string): RequestContext {
  const ctx = new RequestContext();
  if (resourceId !== undefined) {
    ctx.set('controller', { resourceId, getState: () => ({ factoryProjectId }) });
  }
  return ctx;
}

async function seedProject(): Promise<void> {
  PROJECT_ID = (await seed.projects.create({ orgId: ORG_ID, userId: 'user-1', input: { name: 'Acme app' } })).id;
}

function connect() {
  return seed.integrations.forIntegration('gitlab').connections.upsert(ORG_ID, {
    userId: 'user-1',
    data: { accessToken: 'gl-access', connectedAs: 'factory-bot' },
  });
}

function build(ctx: RequestContext) {
  return buildGitlabAgentTools({ gitlab, requestContext: ctx });
}

async function toolsForProject() {
  await seedProject();
  await connect();
  return build(requestContextFor(PROJECT_ID));
}

beforeEach(async () => {
  projectLookupShouldFail = false;
  PROJECT_ID = '';
  getIssue.mockReset().mockResolvedValue(ISSUE);
  createIssueNote.mockReset().mockResolvedValue({ id: 55 });

  seed = await createFactoryStorageForTests();
  const getById = seed.projects.getById.bind(seed.projects);
  vi.spyOn(seed.projects, 'getById').mockImplementation(async input => {
    if (projectLookupShouldFail) throw new Error('connection refused');
    return getById(input);
  });

  gitlab = new GitLabIntegration({ clientId: 'gl_client', clientSecret: 'gl_secret', webhookSecret: 'hook-secret' });
  gitlab.initialize({
    storage: seed.integrations.forIntegration('gitlab'),
    projects: seed.projects,
    auth: fakeRouteAuth(),
  });
  vi.spyOn(
    gitlab as unknown as { clientForConnection: (...args: never[]) => unknown },
    'clientForConnection',
  ).mockReturnValue({
    getIssue: (...args: never[]) => getIssue(...args),
    listIssueNotes: async () => [],
    createIssueNote: (...args: never[]) => createIssueNote(...args),
  });
});

describe('exposure gating', () => {
  it('exposes the GitLab tools when the project org has a connection', async () => {
    expect(await toolsForProject()).toEqual({
      gitlab_get_issue: expect.anything(),
      gitlab_create_comment: expect.anything(),
    });
  });

  it('resolves a board run from its factory project rather than its session id', async () => {
    await seedProject();
    await connect();
    // A board run's resourceId is the work-item session, so the project id has
    // to come from controller state or a triage agent gets no tools at all.
    const tools = await build(requestContextFor('work-item-session-id', PROJECT_ID));
    expect(tools).toHaveProperty('gitlab_get_issue');
  });

  it('exposes nothing when the org never connected GitLab', async () => {
    await seedProject();
    expect(await build(requestContextFor(PROJECT_ID))).toEqual({});
  });

  it('exposes nothing without a controller on the request', async () => {
    expect(await build(new RequestContext())).toEqual({});
  });

  it('exposes nothing for a resource that is not a Factory project', async () => {
    await connect();
    expect(await build(requestContextFor('not-a-uuid'))).toEqual({});
  });

  it('does not cache a transient project-lookup failure', async () => {
    await seedProject();
    await connect();
    projectLookupShouldFail = true;
    expect(await build(requestContextFor(PROJECT_ID))).toEqual({});

    projectLookupShouldFail = false;
    expect(await build(requestContextFor(PROJECT_ID))).toHaveProperty('gitlab_get_issue');
  });

  it('offers the tools to a static-token deployment with no stored grant', async () => {
    // The fallback token is org-agnostic, so a token-only host still works.
    const tokenOnly = new GitLabIntegration({ accessToken: 'static-token', webhookSecret: 'hook-secret' });
    tokenOnly.initialize({
      storage: seed.integrations.forIntegration('gitlab'),
      projects: seed.projects,
      auth: fakeRouteAuth(),
    });
    await seedProject();
    expect(
      await buildGitlabAgentTools({ gitlab: tokenOnly, requestContext: requestContextFor(PROJECT_ID) }),
    ).toHaveProperty('gitlab_get_issue');
  });
});

describe('gitlab_get_issue', () => {
  async function run(issue: string) {
    const tools = await toolsForProject();
    return (tools.gitlab_get_issue!.execute as any)({ issue });
  }

  it('returns the issue detail with its notes', async () => {
    expect(await run('42!7')).toMatchObject({ identifier: 'acme/app#7', title: 'Widget explodes' });
  });

  it.each([
    ['42!7', 'the stored external id'],
    ['https://gitlab.example.com/acme/app/-/issues/7', 'an issue URL'],
    ['acme/app#7', 'a namespaced reference'],
  ])('accepts %s (%s)', async issue => {
    await expect(run(issue)).resolves.toMatchObject({ title: 'Widget explodes' });
  });

  it('resolves a URL to the project path GitLab addresses', async () => {
    await run('https://gitlab.example.com/acme/app/-/issues/7');
    expect(getIssue).toHaveBeenCalledWith({ projectId: 'acme%2Fapp', iid: 7 });
  });

  it('reports an unparseable reference as not found rather than throwing', async () => {
    expect(await run('issue seven')).toMatchObject({ error: expect.stringContaining('not found') });
  });

  it('reports a missing issue distinctly from a missing connection', async () => {
    getIssue.mockResolvedValue(null);
    expect(await run('42!7')).toMatchObject({ error: expect.stringContaining('not found') });
  });
});

describe('gitlab_create_comment', () => {
  it('posts a note and returns its permalink', async () => {
    const tools = await toolsForProject();
    const result = await (tools.gitlab_create_comment!.execute as any)({ issue: '42!7', body: 'Triage findings.' });

    expect(createIssueNote).toHaveBeenCalledWith({ projectId: '42', iid: 7 }, 'Triage findings.');
    expect(result).toEqual({ posted: true, url: `${ISSUE.web_url}#note_55` });
  });

  it('reports a missing issue rather than claiming a post succeeded', async () => {
    getIssue.mockResolvedValue(null);
    const tools = await toolsForProject();
    const result = await (tools.gitlab_create_comment!.execute as any)({ issue: '42!7', body: 'Triage findings.' });

    expect(createIssueNote).not.toHaveBeenCalled();
    expect(result).toMatchObject({ error: expect.stringContaining('not found') });
  });
});

describe('disconnected orgs', () => {
  it('tells the model to connect GitLab rather than reporting a missing issue', async () => {
    // The tool instance can outlive the connection (a revoked grant mid-run),
    // so the disconnected case has to be distinguishable after gating passed.
    await seedProject();
    await connect();
    const tools = await build(requestContextFor(PROJECT_ID));
    await seed.integrations.forIntegration('gitlab').connections.delete(ORG_ID);

    expect(await (tools.gitlab_get_issue!.execute as any)({ issue: '42!7' })).toMatchObject({
      error: expect.stringContaining('not connected'),
    });
  });
});
