import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import type { VersionControl } from '../capabilities/version-control.js';
import type { AuditAgentEmitter } from '../storage/domains/audit/domain.js';
import { SourceControlStorageInMemory } from '../storage/domains/source-control/inmemory.js';
import { createSourceControlTools } from './source-control-tools.js';

function requestContext({ orgId = 'org-1', userId = 'user-1' } = {}) {
  const requestContext = new RequestContext();
  requestContext.set('user', { workosId: userId, organizationId: orgId });
  requestContext.set('controller', {
    resourceId: 'session-1',
    threadId: 'thread-1',
    scope: 'scope-1',
    session: { id: 'session-1', ownerId: userId },
    getState: () => ({ factoryProjectId: 'project-1', projectRepositoryId: 'repo-link-1' }),
  } as unknown as AgentControllerRequestContext);
  return requestContext;
}

async function fixture(integrationId = 'gitlab') {
  const storage = new SourceControlStorageInMemory(integrationId);
  const now = new Date();
  storage.installationsRows.push({
    id: 'install-1',
    integrationId,
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: 'install-external-1',
    accountName: 'acme',
    accountType: 'group',
    providerMetadata: {},
    createdAt: now,
  });
  storage.repositoriesRows.push({
    id: 'repo-1',
    installationId: 'install-1',
    externalId: 'project-1',
    slug: 'acme/repo',
    defaultBranch: 'main',
    providerMetadata: {},
    createdAt: now,
    updatedAt: now,
  });
  storage.connectionsRows.push({
    id: 'connection-1',
    factoryProjectId: 'project-1',
    integrationId,
    installationId: 'install-1',
    createdByUserId: 'user-1',
    createdAt: now,
  });
  storage.projectRepositoriesRows.push({
    id: 'repo-link-1',
    connectionId: 'connection-1',
    repositoryId: 'repo-1',
    createdByUserId: 'user-1',
    branch: null,
    sandboxProvider: 'custom',
    sandboxWorkdir: '/workspace/repo',
    setupCommand: null,
    teardownCommand: null,
    createdAt: now,
    updatedAt: now,
  });
  await storage.sessions.create({
    sessionId: 'session-1',
    projectRepositoryId: 'repo-link-1',
    orgId: 'org-1',
    userId: 'user-1',
    branch: 'factory/issue-1',
    baseBranch: 'main',
    visibility: 'org',
  });

  const createPullRequest = vi.fn(async () => ({
    id: '17',
    title: 'Ship it',
    url: 'https://gitlab.com/acme/repo/-/merge_requests/17',
    author: 'bot',
    body: 'Body',
    state: 'open' as const,
    draft: false,
    merged: false,
    mergeable: true,
    baseBranch: 'main',
    headBranch: 'factory/issue-1',
    headSha: 'abc',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }));
  const getRepositoryTarget = vi.fn(async () => ({
    connection: { type: 'oauth' as const, accessToken: 'server-opaque-connection' },
    sourceId: 'acme/repo',
  }));
  const createReviewComment = vi.fn(async () => ({
    id: 'discussion-note-1',
    url: 'https://gitlab.com/acme/repo/-/merge_requests/17#note_1',
    author: 'bot',
    body: 'Comment',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    path: 'src/index.ts',
    line: 12,
    side: 'right' as const,
    commitId: 'abc',
    replyToId: null,
  }));
  const resolveReviewThread = vi.fn(async () => undefined);
  const listReviews = vi.fn(async () => ({ reviews: [], nextCursor: null }));
  const versionControl = {
    getRepositoryTarget,
    createPullRequest,
    createReviewComment,
    resolveReviewThread,
    listReviews,
  } as unknown as VersionControl;
  const emitAgent = vi.fn(async () => undefined);
  const audit = { emitAgent } as unknown as AuditAgentEmitter;
  return {
    storage,
    versionControl,
    createPullRequest,
    createReviewComment,
    resolveReviewThread,
    listReviews,
    getRepositoryTarget,
    audit,
    emitAgent,
  };
}

describe('createSourceControlTools', () => {
  it('lists reviews through the active repository connection without exposing provider credentials', async () => {
    const setup = await fixture();
    const tools = createSourceControlTools({
      requestContext: requestContext(),
      providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
      audit: setup.audit,
    });

    await expect(
      (tools.source_control_list_change_request_reviews!.execute as any)({ changeRequestId: 17 }),
    ).resolves.toEqual({
      reviews: [],
      nextCursor: null,
    });
    expect(setup.listReviews).toHaveBeenCalledWith({
      connection: { type: 'oauth', accessToken: 'server-opaque-connection' },
      sourceId: 'acme/repo',
      actingUserId: 'user-1',
      pullRequestId: '17',
    });
  });

  it('creates a change request only for the active persisted session target', async () => {
    const setup = await fixture();
    const tools = createSourceControlTools({
      requestContext: requestContext(),
      providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
      audit: setup.audit,
    });

    const result = await (tools.source_control_create_change_request!.execute as any)({
      title: 'Ship it',
      body: 'Body',
    });

    expect(result).toMatchObject({ id: '17', title: 'Ship it' });
    expect(setup.getRepositoryTarget).toHaveBeenCalledWith({ orgId: 'org-1', repositoryId: 'repo-1' });
    expect(setup.createPullRequest).toHaveBeenCalledWith({
      connection: { type: 'oauth', accessToken: 'server-opaque-connection' },
      sourceId: 'acme/repo',
      actingUserId: 'user-1',
      title: 'Ship it',
      body: 'Body',
      baseBranch: 'main',
      headBranch: 'factory/issue-1',
    });
    expect(setup.emitAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ action: 'factory.agent.pr_opened' }),
      }),
    );
  });

  it('creates brokered diff discussions and replies without accepting repository credentials', async () => {
    const setup = await fixture();
    const tools = createSourceControlTools({
      requestContext: requestContext(),
      providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
      audit: setup.audit,
    });

    await (tools.source_control_create_diff_comment!.execute as any)({
      changeRequestId: 17,
      body: 'Please cover this branch.',
      commitId: 'abc',
      path: 'src/index.ts',
      line: 12,
      side: 'right',
    });
    await (tools.source_control_create_diff_comment!.execute as any)({
      changeRequestId: 17,
      body: 'Addressed.',
      replyToId: 'discussion-note-1',
    });

    expect(setup.createReviewComment).toHaveBeenNthCalledWith(1, {
      connection: { type: 'oauth', accessToken: 'server-opaque-connection' },
      sourceId: 'acme/repo',
      actingUserId: 'user-1',
      pullRequestId: '17',
      body: 'Please cover this branch.',
      commitId: 'abc',
      path: 'src/index.ts',
      line: 12,
      side: 'right',
    });
    expect(setup.createReviewComment).toHaveBeenNthCalledWith(2, {
      connection: { type: 'oauth', accessToken: 'server-opaque-connection' },
      sourceId: 'acme/repo',
      actingUserId: 'user-1',
      pullRequestId: '17',
      body: 'Addressed.',
      replyToId: 'discussion-note-1',
    });
    await expect(
      (tools.source_control_resolve_diff_thread!.execute as any)({
        commentId: 'discussion-note-1',
        resolved: true,
      }),
    ).resolves.toEqual({ resolved: true });
    expect(setup.resolveReviewThread).toHaveBeenCalledWith({
      connection: { type: 'oauth', accessToken: 'server-opaque-connection' },
      sourceId: 'acme/repo',
      actingUserId: 'user-1',
      commentId: 'discussion-note-1',
      resolved: true,
    });
  });

  it('validates review bodies before execution', async () => {
    const setup = await fixture();
    const tools = createSourceControlTools({
      requestContext: requestContext(),
      providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
      audit: setup.audit,
    });
    const schema = tools.source_control_review_change_request!.inputSchema as {
      safeParse(input: unknown): { success: boolean };
    };

    expect(schema.safeParse({ changeRequestId: 17, event: 'approve' }).success).toBe(true);
    expect(schema.safeParse({ changeRequestId: 17, event: 'comment', body: 'Ship it' }).success).toBe(true);
    expect(schema.safeParse({ changeRequestId: 17, event: 'request-changes', body: '   ' }).success).toBe(false);
    expect(schema.safeParse({ changeRequestId: 17, event: 'comment' }).success).toBe(false);
  });

  it('fails closed before provider access for a cross-organization caller', async () => {
    const setup = await fixture();
    const tools = createSourceControlTools({
      requestContext: requestContext({ orgId: 'org-2' }),
      providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
      audit: setup.audit,
    });

    await expect(
      (tools.source_control_create_change_request!.execute as any)({ title: 'Wrong tenant' }),
    ).rejects.toThrow('not available to the authenticated user');
    expect(setup.getRepositoryTarget).not.toHaveBeenCalled();
    expect(setup.createPullRequest).not.toHaveBeenCalled();
  });

  it('rejects checkout refresh outside a bound GitLab MR review session', async () => {
    const setup = await fixture();
    const tools = createSourceControlTools({
      requestContext: requestContext(),
      providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
      audit: setup.audit,
    });
    await expect((tools.source_control_refresh_change_request_checkout!.execute as any)({})).rejects.toThrow(
      'only available in a bound GitLab merge-request review session',
    );
    expect(setup.getRepositoryTarget).not.toHaveBeenCalled();
  });

  it('fails closed when a session exists in more than one provider partition', async () => {
    const first = await fixture('gitlab');
    const second = await fixture('github');
    const tools = createSourceControlTools({
      requestContext: requestContext(),
      providers: [
        { id: 'gitlab', storage: first.storage, versionControl: first.versionControl },
        { id: 'github', storage: second.storage, versionControl: second.versionControl },
      ],
      audit: first.audit,
    });

    await expect((tools.source_control_get_change_request!.execute as any)({ changeRequestId: 17 })).rejects.toThrow(
      'ambiguous across source-control providers',
    );
    expect(first.getRepositoryTarget).not.toHaveBeenCalled();
    expect(second.getRepositoryTarget).not.toHaveBeenCalled();
  });

  it('offers no tools without an authenticated request context', async () => {
    const setup = await fixture();
    expect(
      createSourceControlTools({
        requestContext: new RequestContext(),
        providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
        audit: setup.audit,
      }),
    ).toEqual({});
  });
});
