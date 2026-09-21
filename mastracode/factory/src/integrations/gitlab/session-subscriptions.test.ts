import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GitLabIntegrationBase } from './integration.js';

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(async (_input: { source: string; sessionScope?: string }) => ({ created: true })),
  unsubscribe: vi.fn(async (_input: { sessionScope?: string }) => undefined),
  getPullRequest: vi.fn(async () => ({
    id: '17',
    url: 'https://gitlab.example.com/acme/app/-/merge_requests/17',
    state: 'open',
  })),
  getRepositoryTarget: vi.fn(async () => ({
    connection: { type: 'oauth', accessToken: 'gitlab-connection:direct' },
    sourceId: '101:acme/app',
  })),
}));

vi.mock('./subscriptions', () => ({
  subscribeToMergeRequest: mocks.subscribe,
  unsubscribeFromMergeRequest: mocks.unsubscribe,
}));

import {
  createGitLabSubscriptionTools,
  parseCreatedMergeRequest,
  parseMergeRequestUrl,
  subscribeCurrentSessionToMergeRequest,
  unsubscribeCurrentSessionFromMergeRequest,
} from './session-subscriptions.js';

const rows = {
  projectRepository: { id: 'project-repository-1', connectionId: 'connection-1', repositoryId: 'repository-1' },
  connection: {
    id: 'connection-1',
    factoryProjectId: 'resource-1',
    installationId: 'installation-1',
    integrationId: 'gitlab',
  },
  repository: { id: 'repository-1', installationId: 'installation-1', externalId: '101', slug: 'acme/app' },
  installation: { id: 'installation-1', externalId: 'direct', providerMetadata: { host: 'GitLab.Example.com' } },
};

function gitlabStub(overrides: Partial<typeof rows> = {}) {
  const data = { ...rows, ...overrides };
  return {
    integrationStorage: { subscriptions: {} },
    sourceControlStorage: {
      projectRepositories: { get: vi.fn(async () => data.projectRepository) },
      connections: { get: vi.fn(async () => data.connection) },
      repositories: { get: vi.fn(async () => data.repository) },
      installations: { get: vi.fn(async () => data.installation) },
    },
    versionControl: { getPullRequest: mocks.getPullRequest, getRepositoryTarget: mocks.getRepositoryTarget },
  } as unknown as GitLabIntegrationBase;
}

function authenticatedRequestContext(scope = '/worktrees/a') {
  const requestContext = new RequestContext();
  requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
  requestContext.set('controller', {
    resourceId: 'resource-1',
    threadId: 'thread-1',
    scope,
    session: { id: 'session-1', ownerId: 'user-1', modeId: 'build' },
    getState: () => ({ factoryProjectId: 'resource-1', projectRepositoryId: 'project-repository-1' }),
  });
  return requestContext;
}

beforeEach(() => {
  mocks.subscribe.mockClear();
  mocks.unsubscribe.mockClear();
  mocks.getPullRequest.mockClear();
  mocks.getRepositoryTarget.mockClear();
});

describe('parseCreatedMergeRequest', () => {
  it('reads the merge request URL from a successful shared change-request tool result', () => {
    expect(
      parseCreatedMergeRequest({
        toolName: 'source_control_create_change_request',
        input: { title: 'Fix' },
        output: { id: '17', url: 'https://gitlab.example.com/acme/sub/app/-/merge_requests/17/' },
      }),
    ).toBe('https://gitlab.example.com/acme/sub/app/-/merge_requests/17');
  });

  it.each([
    {
      toolName: 'execute_command',
      input: { command: 'glab mr create' },
      output: 'https://gitlab.com/a/b/-/merge_requests/1',
    },
    { toolName: 'source_control_create_change_request', input: {}, output: { url: 'https://github.com/o/r/pull/1' } },
    { toolName: 'source_control_create_change_request', input: {}, output: { url: 'not-a-url' } },
    {
      toolName: 'source_control_create_change_request',
      input: {},
      output: { url: 'https://gitlab.com/a/b/-/merge_requests/1' },
      error: new Error('failed'),
    },
  ])('ignores %o', context => {
    expect(parseCreatedMergeRequest(context)).toBeUndefined();
  });

  it('parses hosts, nested paths and IIDs, rejecting non-positive IIDs', () => {
    expect(parseMergeRequestUrl('https://GitLab.Example.com/acme/sub/app/-/merge_requests/42')).toEqual({
      host: 'gitlab.example.com',
      projectPath: 'acme/sub/app',
      iid: 42,
    });
    expect(parseMergeRequestUrl('https://gitlab.example.com/acme/app/-/merge_requests/0')).toBeUndefined();
  });
});

describe('GitLab subscription entry points', () => {
  it('does not expose tools without authenticated repository context or an active thread', () => {
    const noUser = new RequestContext();
    noUser.set('controller', {
      threadId: 'thread-1',
      getState: () => ({ projectRepositoryId: 'project-repository-1' }),
    });
    expect(createGitLabSubscriptionTools(noUser, gitlabStub())).toEqual({});

    const noThread = new RequestContext();
    noThread.set('user', { workosId: 'user-1', organizationId: 'org-1' });
    noThread.set('controller', { getState: () => ({ projectRepositoryId: 'project-repository-1' }) });
    expect(createGitLabSubscriptionTools(noThread, gitlabStub())).toEqual({});

    expect(Object.keys(createGitLabSubscriptionTools(authenticatedRequestContext(), gitlabStub()))).toEqual([
      'gitlab_subscribe_mr',
      'gitlab_unsubscribe_mr',
    ]);
  });

  it('auto-subscribes the active GitLab session to a merge request it created', async () => {
    await expect(
      subscribeCurrentSessionToMergeRequest(
        authenticatedRequestContext(),
        'https://gitlab.example.com/Acme/App/-/merge_requests/17',
        'auto-create-change-request',
        gitlabStub(),
      ),
    ).resolves.toBe(17);

    expect(mocks.getRepositoryTarget).toHaveBeenCalledWith({ orgId: 'org-1', repositoryId: 'repository-1' });
    expect(mocks.getPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: '101:acme/app', pullRequestId: '17' }),
    );
    expect(mocks.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        host: 'gitlab.example.com',
        projectId: '101',
        projectPath: 'acme/app',
        projectRepositoryId: 'project-repository-1',
        installationExternalId: 'direct',
        changeRequestId: '17',
        sessionId: 'session-1',
        ownerId: 'user-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        sessionScope: '/worktrees/a',
        source: 'auto-create-change-request',
        subscribedByUserId: 'user-1',
      }),
      expect.anything(),
    );
  });

  it('silently skips the auto path outside a GitLab repository session', async () => {
    const localSession = new RequestContext();
    localSession.set('controller', { threadId: 'thread-1', getState: () => ({}) });
    await expect(
      subscribeCurrentSessionToMergeRequest(
        localSession,
        'https://gitlab.example.com/acme/app/-/merge_requests/17',
        'auto-create-change-request',
        gitlabStub(),
      ),
    ).resolves.toBeUndefined();

    // A GitHub-linked repository is absent from the GitLab source-control handle.
    const githubSession = gitlabStub();
    (githubSession.sourceControlStorage!.projectRepositories.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      subscribeCurrentSessionToMergeRequest(
        authenticatedRequestContext(),
        'https://gitlab.example.com/acme/app/-/merge_requests/17',
        'auto-create-change-request',
        githubSession,
      ),
    ).resolves.toBeUndefined();
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it('rejects merge requests from another host or project, and missing ones', async () => {
    await expect(
      subscribeCurrentSessionToMergeRequest(
        authenticatedRequestContext(),
        'https://gitlab.other.example/acme/app/-/merge_requests/17',
        'explicit-tool',
        gitlabStub(),
      ),
    ).rejects.toThrow(/must belong to gitlab.example.com\/acme\/app/);
    await expect(
      subscribeCurrentSessionToMergeRequest(
        authenticatedRequestContext(),
        'https://gitlab.example.com/acme/other/-/merge_requests/17',
        'explicit-tool',
        gitlabStub(),
      ),
    ).rejects.toThrow(/must belong to/);

    mocks.getPullRequest.mockResolvedValueOnce(null as never);
    await expect(
      subscribeCurrentSessionToMergeRequest(authenticatedRequestContext(), 17, 'explicit-tool', gitlabStub()),
    ).rejects.toThrow(/was not found/);

    mocks.getPullRequest.mockResolvedValueOnce({
      id: '17',
      url: 'https://gitlab.example.com/acme/other/-/merge_requests/17',
      state: 'open',
    } as never);
    await expect(
      subscribeCurrentSessionToMergeRequest(authenticatedRequestContext(), 17, 'explicit-tool', gitlabStub()),
    ).rejects.toThrow(/does not match the active project repository/);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it('explicit tools fail loudly outside a GitLab-backed session', async () => {
    const stub = gitlabStub({ connection: { ...rows.connection, integrationId: 'github' } });
    await expect(
      subscribeCurrentSessionToMergeRequest(authenticatedRequestContext(), 17, 'explicit-tool', stub),
    ).rejects.toThrow(/not backed by a GitLab repository/);
    await expect(unsubscribeCurrentSessionFromMergeRequest(new RequestContext(), 17, gitlabStub())).rejects.toThrow(
      /authenticated repository session/,
    );
  });

  it('unsubscribes the same session identity it subscribed with', async () => {
    await expect(
      unsubscribeCurrentSessionFromMergeRequest(authenticatedRequestContext('/worktrees/b'), '17', gitlabStub()),
    ).resolves.toBe(17);
    expect(mocks.unsubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ changeRequestId: '17', sessionScope: '/worktrees/b', sessionId: 'session-1' }),
      expect.anything(),
    );
  });
});
