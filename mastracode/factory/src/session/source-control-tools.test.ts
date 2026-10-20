import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { VersionControl } from '../capabilities/version-control.js';
import type { AuditAgentEmitter } from '../storage/domains/audit/domain.js';
import { SourceControlStorageInMemory } from '../storage/domains/source-control/inmemory.js';
import { createSourceControlTools, FACTORY_TEST_CHECK_NAME } from './source-control-tools.js';

function requestContext({ orgId = 'org-1', userId = 'user-1' } = {}) {
  const requestContext = new RequestContext();
  requestContext.set('user', { workosId: userId, organizationId: orgId });
  requestContext.set('controller', {
    // The session runs under its Factory, so only its session id names the source-control session.
    sessionId: 'session-1',
    resourceId: 'project-1',
    threadId: 'thread-1',
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
  storage.repositoriesRows.push({
    id: 'repo-2',
    installationId: 'install-1',
    externalId: 'project-2',
    slug: 'acme/other',
    defaultBranch: 'develop',
    providerMetadata: {},
    createdAt: now,
    updatedAt: now,
  });
  const link = (id: string, repositoryId: string, position: number) => ({
    id,
    connectionId: 'connection-1',
    repositoryId,
    createdByUserId: 'user-1',
    branch: null,
    sandboxProvider: 'custom',
    sandboxWorkdir: '/workspace/repo',
    setupCommand: null,
    teardownCommand: null,
    position,
    inEnvironment: true,
    lastBuildStatus: 'unbuilt' as const,
    lastBuildError: null,
    lastBuiltAt: null,
    createdAt: now,
    updatedAt: now,
  });
  storage.projectRepositoriesRows.push(link('repo-link-1', 'repo-1', 1), link('repo-link-2', 'repo-2', 2));
  await storage.sessions.create({
    sessionId: 'session-1',
    projectRepositoryId: 'repo-link-1',
    orgId: 'org-1',
    userId: 'user-1',
    branch: 'factory/issue-1',
    baseBranch: 'main',
    visibility: 'org',
  });

  const createPullRequest = vi.fn(async (input: { sourceId: string; baseBranch: string }) => ({
    id: input.sourceId === 'acme/other' ? '18' : '17',
    title: 'Ship it',
    url: `https://gitlab.com/${input.sourceId}/-/merge_requests/${input.sourceId === 'acme/other' ? 18 : 17}`,
    author: 'bot',
    body: 'Body',
    state: 'open' as const,
    draft: false,
    merged: false,
    mergeable: true,
    baseBranch: input.baseBranch,
    headBranch: 'factory/issue-1',
    headSha: 'abc',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }));
  const getRepositoryTarget = vi.fn(async ({ repositoryId }: { repositoryId: string }) => ({
    connection: { type: 'oauth' as const, accessToken: 'server-opaque-connection' },
    sourceId: repositoryId === 'repo-2' ? 'acme/other' : 'acme/repo',
  }));
  const getRepositoryAccess = vi.fn(async ({ repositoryId }: { repositoryId: string }) => ({
    cloneUrl: `https://gitlab.com/${repositoryId === 'repo-2' ? 'acme/other' : 'acme/repo'}.git`,
    authorization: { scheme: 'bearer' as const, token: 'glpat-secret', username: 'oauth2' },
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
  const getPullRequest = vi.fn(async () => ({ id: '17', headSha: 'cd1e5903851234567890abcdef1234567890abcd' }));
  const createReview = vi.fn(async () => ({ id: 'review-1' }));
  const closePullRequest = vi.fn(async () => ({ id: '17', state: 'closed' }));
  const versionControl = {
    closePullRequest,
    getRepositoryTarget,
    getRepositoryAccess,
    getPullRequest,
    createReview,
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
    closePullRequest,
    createReviewComment,
    resolveReviewThread,
    listReviews,
    getPullRequest,
    createReview,
    getRepositoryTarget,
    getRepositoryAccess,
    audit,
    emitAgent,
  };
}

describe('createSourceControlTools', () => {
  it('lists reviews through the active repository connection without exposing provider credentials', async () => {
    const setup = await fixture();
    const tools = await createSourceControlTools({
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
    const tools = await createSourceControlTools({
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

  describe('self-review gate', () => {
    const approved = 'a'.repeat(40);
    const gated = async (approvedHead: string | null, pushedHead = approved) => {
      const setup = await fixture();
      const original = setup.createPullRequest.getMockImplementation()!;
      setup.createPullRequest.mockImplementation(async (input: any) => ({
        ...(await original(input)),
        headSha: pushedHead,
      }));
      const tools = await createSourceControlTools({
        requestContext: requestContext(),
        providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
        audit: setup.audit,
        selfReviewApprovedHead: async () => approvedHead,
      });
      const run = () => (tools.source_control_create_change_request!.execute as any)({ title: 'Ship it' });
      return { setup, run };
    };

    it('refuses to open a change request before self-review approves', async () => {
      const { setup, run } = await gated(null);
      await expect(run()).rejects.toThrow('Self-review has not approved');
      expect(setup.createPullRequest).not.toHaveBeenCalled();
    });

    it('closes the change request when the pushed head differs from the approved head', async () => {
      const { setup, run } = await gated(approved, 'b'.repeat(40));
      await expect(run()).rejects.toThrow('the change request was closed');
      expect(setup.closePullRequest).toHaveBeenCalledWith(expect.objectContaining({ pullRequestId: '17' }));
    });

    it('opens the change request when the pushed head matches the approved head', async () => {
      const { setup, run } = await gated(approved, approved.toUpperCase());
      await expect(run()).resolves.toMatchObject({ id: '17' });
      expect(setup.closePullRequest).not.toHaveBeenCalled();
    });
  });

  it('creates brokered diff discussions and replies without accepting repository credentials', async () => {
    const setup = await fixture();
    const tools = await createSourceControlTools({
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

  it('publishes diff-comment input as one object schema admitting either mode', async () => {
    const setup = await fixture();
    const tools = await createSourceControlTools({
      requestContext: requestContext(),
      providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
      audit: setup.audit,
    });
    const schema = tools.source_control_create_diff_comment!.inputSchema as {
      safeParse(input: unknown): { success: boolean };
      '~standard': { jsonSchema: { input(options: { target: string }): { type?: unknown } } };
    };

    // Provider function parameters must be an object schema at the root.
    expect(schema['~standard'].jsonSchema.input({ target: 'draft-07' }).type).toBe('object');

    expect(
      schema.safeParse({
        changeRequestId: 17,
        body: 'Please cover this branch.',
        commitId: 'abc',
        path: 'src/index.ts',
        line: 12,
        side: 'right',
      }).success,
    ).toBe(true);
    expect(schema.safeParse({ changeRequestId: 17, body: 'Addressed.', replyToId: 'discussion-note-1' }).success).toBe(
      true,
    );
    expect(schema.safeParse({ changeRequestId: 17, body: 'No target.' }).success).toBe(false);
    expect(
      schema.safeParse({ changeRequestId: 17, body: 'Half an anchor.', commitId: 'abc', path: 'src/index.ts' }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        changeRequestId: 17,
        body: 'Both modes at once.',
        replyToId: 'discussion-note-1',
        commitId: 'abc',
        path: 'src/index.ts',
        line: 12,
        side: 'right',
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        changeRequestId: 17,
        body: 'Unpaired range.',
        commitId: 'abc',
        path: 'src/index.ts',
        line: 12,
        side: 'right',
        startLine: 3,
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        changeRequestId: 17,
        body: 'Paired range.',
        commitId: 'abc',
        path: 'src/index.ts',
        line: 12,
        side: 'right',
        startLine: 3,
        startSide: 'right',
      }).success,
    ).toBe(true);
  });

  it('validates review bodies before execution', async () => {
    const setup = await fixture();
    const tools = await createSourceControlTools({
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
    const tools = await createSourceControlTools({
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
    const tools = await createSourceControlTools({
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
    const tools = await createSourceControlTools({
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
    await expect(
      createSourceControlTools({
        requestContext: new RequestContext(),
        providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
        audit: setup.audit,
      }),
    ).resolves.toEqual({});
  });

  describe('environment repositories', () => {
    function fakeSandbox(checkouts: { missingBranch?: string[]; remotes?: Record<string, string> } = {}) {
      const executions: Array<{ command: string; args: string[]; options?: { env?: Record<string, string> } }> = [];
      const sandbox = {
        id: 'sandbox-1',
        provider: 'custom',
        workingDirectory: '/home/user',
        executeCommand: vi.fn(async (command: string, args: string[], options?: { env?: Record<string, string> }) => {
          executions.push({ command, args, options });
          const workdir = args[args.indexOf('-C') + 1]!;
          if (args.includes('show-ref')) {
            return { exitCode: checkouts.missingBranch?.includes(workdir) ? 1 : 0, stdout: '', stderr: '' };
          }
          if (args.includes('get-url')) {
            const remote = checkouts.remotes?.[workdir] ?? `https://gitlab.com/acme/${workdir.split('/').pop()}.git`;
            return { exitCode: 0, stdout: `${remote}\n`, stderr: '' };
          }
          return { exitCode: 0, stdout: '', stderr: '' };
        }),
      };
      const pushes = () => executions.filter(entry => entry.command === 'git' && entry.args.includes('push'));
      return { sandbox, executions, pushes };
    }

    async function tools(setup: Awaited<ReturnType<typeof fixture>>) {
      return createSourceControlTools({
        requestContext: requestContext(),
        providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
        audit: setup.audit,
      });
    }

    it('lists the environment slugs and the default in the tool descriptions', async () => {
      const setup = await fixture();
      const built = await tools(setup);
      expect(built.source_control_push_branch!.description).toContain('acme/repo, acme/other');
      expect(built.source_control_push_branch!.description).toContain(
        "Defaults to acme/repo, this session's repository",
      );
      expect(built.source_control_create_change_request!.description).toContain('acme/repo, acme/other');
      const pushSchema = built.source_control_push_branch!.inputSchema as any;
      expect(pushSchema.safeParse({}).success).toBe(true);
      expect(Object.keys(pushSchema.shape)).toEqual(['repository']);
      const crSchema = built.source_control_create_change_request!.inputSchema as any;
      expect(Object.keys(crSchema.shape).sort()).toEqual(['body', 'draft', 'repository', 'title']);
    });

    it('reads, comments on and merges a change request in another environment repository', async () => {
      const setup = await fixture();
      const built = await tools(setup);

      await (built.source_control_get_change_request!.execute as any)({
        changeRequestId: 18,
        repository: 'acme/other',
      });
      await (built.source_control_list_change_request_reviews!.execute as any)({
        changeRequestId: 18,
        repository: 'acme/other',
      });

      expect(setup.getPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: 'acme/other', pullRequestId: '18' }),
      );
      expect(setup.listReviews).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: 'acme/other', pullRequestId: '18' }),
      );
      expect(setup.getRepositoryTarget).toHaveBeenCalledWith({ orgId: 'org-1', repositoryId: 'repo-2' });
      for (const name of [
        'source_control_get_change_request',
        'source_control_comment_change_request',
        'source_control_merge_change_request',
        'source_control_update_diff_comment',
        'source_control_resolve_diff_thread',
      ] as const) {
        expect(built[name]!.description).toContain('acme/repo, acme/other');
        expect(Object.keys((built[name]!.inputSchema as any).shape)).toContain('repository');
      }
      await expect(
        (built.source_control_get_change_request!.execute as any)({ changeRequestId: 18, repository: 'nope/x' }),
      ).rejects.toThrow("Repository 'nope/x' is not in this Factory's environment.");
    });

    it("pushes the session's own repository by default and records the row", async () => {
      const setup = await fixture();
      const built = await tools(setup);
      const { sandbox, pushes } = fakeSandbox();

      const result = await (built.source_control_push_branch!.execute as any)({}, { workspace: { sandbox } });

      expect(result).toEqual({ pushed: true, branch: 'factory/issue-1', repository: 'acme/repo' });
      expect(pushes()).toHaveLength(1);
      expect(pushes()[0]!.args).toEqual(['-C', '/home/user/repo', 'push', '-u', 'origin', 'factory/issue-1']);
      expect(setup.getRepositoryAccess).toHaveBeenCalledWith({ orgId: 'org-1', repositoryId: 'repo-1' });
      await expect(setup.storage.sessionRepositories.listBySession({ sessionId: 'session-1' })).resolves.toMatchObject([
        { projectRepositoryId: 'repo-link-1', branch: 'factory/issue-1', changeRequestUrl: null },
      ]);
      expect(setup.emitAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            action: 'factory.agent.push',
            metadata: expect.objectContaining({ repository: 'acme/repo' }),
          }),
        }),
      );
    });

    it('creates and switches to the session branch in another repository that never had it, then pushes it', async () => {
      const setup = await fixture();
      const built = await tools(setup);
      const { sandbox, pushes, executions } = fakeSandbox({ missingBranch: ['/home/user/other'] });

      const result = await (built.source_control_push_branch!.execute as any)(
        { repository: 'acme/other' },
        { workspace: { sandbox } },
      );

      expect(result).toEqual({ pushed: true, branch: 'factory/issue-1', repository: 'acme/other' });
      expect(executions.map(entry => entry.args)).toContainEqual([
        '-C',
        '/home/user/other',
        'switch',
        '-c',
        'factory/issue-1',
      ]);
      expect(pushes()[0]!.args).toEqual(['-C', '/home/user/other', 'push', '-u', 'origin', 'factory/issue-1']);
      expect(setup.getRepositoryAccess).toHaveBeenCalledWith({ orgId: 'org-1', repositoryId: 'repo-2' });
      expect(JSON.stringify(executions)).not.toContain('glpat-secret');
      await expect(setup.storage.sessionRepositories.listBySession({ sessionId: 'session-1' })).resolves.toMatchObject([
        { projectRepositoryId: 'repo-link-2', branch: 'factory/issue-1' },
      ]);
    });

    it('refuses to push another repository whose directory holds a different checkout', async () => {
      const setup = await fixture();
      const built = await tools(setup);
      // The boot skipped acme/other for a directory-name collision.
      const { sandbox, pushes } = fakeSandbox({
        remotes: { '/home/user/other': 'https://gitlab.com/elsewhere/other.git' },
      });

      await expect(
        (built.source_control_push_branch!.execute as any)({ repository: 'acme/other' }, { workspace: { sandbox } }),
      ).rejects.toThrow('There is no checkout of acme/other in this session.');
      expect(pushes()).toHaveLength(0);
      await expect(setup.storage.sessionRepositories.listBySession({ sessionId: 'session-1' })).resolves.toEqual([]);
    });

    it('rejects a repository outside the environment, naming the valid slugs, and pushes nothing', async () => {
      const setup = await fixture();
      const built = await tools(setup);
      const { sandbox, pushes } = fakeSandbox();

      await expect(
        (built.source_control_push_branch!.execute as any)({ repository: 'nope/x' }, { workspace: { sandbox } }),
      ).rejects.toThrow(
        "Repository 'nope/x' is not in this Factory's environment. Valid repositories: acme/repo, acme/other.",
      );
      expect(pushes()).toHaveLength(0);
      expect(setup.getRepositoryAccess).not.toHaveBeenCalled();
      await expect(setup.storage.sessionRepositories.listBySession({ sessionId: 'session-1' })).resolves.toEqual([]);
    });

    it('opens change requests in two repositories from one session with their own base branches', async () => {
      const setup = await fixture();
      const built = await tools(setup);

      const own = await (built.source_control_create_change_request!.execute as any)({ title: 'Own' });
      const other = await (built.source_control_create_change_request!.execute as any)({
        title: 'Other',
        repository: 'acme/other',
      });

      expect(own.url).toBe('https://gitlab.com/acme/repo/-/merge_requests/17');
      expect(other.url).toBe('https://gitlab.com/acme/other/-/merge_requests/18');
      expect(setup.createPullRequest).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ sourceId: 'acme/repo', baseBranch: 'main', headBranch: 'factory/issue-1' }),
      );
      expect(setup.createPullRequest).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ sourceId: 'acme/other', baseBranch: 'develop', headBranch: 'factory/issue-1' }),
      );
      const rows = await setup.storage.sessionRepositories.listBySession({ sessionId: 'session-1' });
      expect(rows).toMatchObject([
        {
          projectRepositoryId: 'repo-link-1',
          changeRequestId: '17',
          changeRequestUrl: 'https://gitlab.com/acme/repo/-/merge_requests/17',
        },
        {
          projectRepositoryId: 'repo-link-2',
          changeRequestId: '18',
          changeRequestUrl: 'https://gitlab.com/acme/other/-/merge_requests/18',
        },
      ]);
      const audited = setup.emitAgent.mock.calls.map(call => (call as any)[0].input);
      expect(
        audited.filter(input => input.action === 'factory.agent.pr_opened').map(i => i.metadata.repository),
      ).toEqual(['acme/repo', 'acme/other']);
    });

    it('keeps the change request on the row when the branch is pushed again', async () => {
      const setup = await fixture();
      const built = await tools(setup);
      const { sandbox } = fakeSandbox();

      await (built.source_control_push_branch!.execute as any)({}, { workspace: { sandbox } });
      const [pushed] = await setup.storage.sessionRepositories.listBySession({ sessionId: 'session-1' });
      await new Promise(resolve => setTimeout(resolve, 5));
      await (built.source_control_create_change_request!.execute as any)({ title: 'Own' });
      const [opened] = await setup.storage.sessionRepositories.listBySession({ sessionId: 'session-1' });
      // Opening the change request pushes nothing, so the push time stays.
      expect(opened?.pushedAt).toEqual(pushed?.pushedAt);
      expect(opened?.changeRequestUrl).toBe('https://gitlab.com/acme/repo/-/merge_requests/17');

      await (built.source_control_push_branch!.execute as any)({}, { workspace: { sandbox } });

      await expect(setup.storage.sessionRepositories.listBySession({ sessionId: 'session-1' })).resolves.toMatchObject([
        {
          projectRepositoryId: 'repo-link-1',
          branch: 'factory/issue-1',
          changeRequestUrl: 'https://gitlab.com/acme/repo/-/merge_requests/17',
        },
      ]);
    });
  });

  describe('review verdict consistency', () => {
    const head = 'cd1e5903851234567890abcdef1234567890abcd';
    async function submit(input: Record<string, unknown>) {
      const setup = await fixture();
      const tools = await createSourceControlTools({
        requestContext: requestContext(),
        providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
        audit: setup.audit,
      });
      const run = (tools.source_control_review_change_request!.execute as any)({ changeRequestId: 17, ...input });
      return { setup, run };
    }

    async function schemaError(input: Record<string, unknown>) {
      const { setup } = await submit({});
      const tools = await createSourceControlTools({
        requestContext: requestContext(),
        providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
        audit: setup.audit,
      });
      const parsed = (tools.source_control_review_change_request!.inputSchema as any).safeParse({
        changeRequestId: 17,
        ...input,
      });
      expect(parsed.success).toBe(false);
      return parsed.error.issues.map((issue: { message: string }) => issue.message).join('\n');
    }

    it('rejects an approval whose body requests changes', async () => {
      expect(await schemaError({ event: 'approve', body: 'Verdict: request changes\n\nFix it.' })).toMatch(
        /Verdict: request changes.*event is "approve"/,
      );
    });

    it('rejects a request-changes review whose body approves', async () => {
      expect(await schemaError({ event: 'request-changes', body: 'Verdict: approve\n\nLGTM.' })).toMatch(
        /Verdict: approve.*event is "request-changes"/,
      );
    });

    it('rejects a comment review whose body approves', async () => {
      expect(await schemaError({ event: 'comment', body: 'Verdict: approve\n\nLGTM.' })).toMatch(/event is "comment"/);
    });

    it.each(['`ce79aaafad`', head.slice(0, 10), 'the latest commit'])(
      'rejects a reviewed head that is not a full SHA: %s',
      async value => {
        expect(await schemaError({ event: 'approve', body: `Verdict: approve\nReviewed head: ${value}\n` })).toMatch(
          /full 40- or 64-character commit SHA/,
        );
      },
    );

    it('rejects a body whose Reviewed head lines disagree', async () => {
      expect(
        await schemaError({
          event: 'approve',
          body: `Verdict: approve\nReviewed head: ${head}\n\nReviewed head: ${'c'.repeat(40)}\n`,
        }),
      ).toMatch(/same full 40- or 64-character commit SHA/);
    });

    it.each([
      '**Verdict: request changes**',
      '**Verdict:** request changes',
      '# Verdict: request changes',
      'Verdict: changes requested',
    ])('rejects an approval whose markdown-wrapped first line requests changes: %s', async firstLine => {
      expect(await schemaError({ event: 'approve', body: `${firstLine}\n\nFindings` })).toMatch(
        /Verdict: request changes.*event is "approve"/,
      );
    });

    it('rejects a request-changes review whose markdown-wrapped first line approves', async () => {
      expect(await schemaError({ event: 'request-changes', body: '**Verdict:** approve\n' })).toMatch(
        /Verdict: approve.*event is "request-changes"/,
      );
    });

    it('accepts consistent verdict and full-SHA bodies in the schema', async () => {
      const { setup } = await submit({});
      const tools = await createSourceControlTools({
        requestContext: requestContext(),
        providers: [{ id: 'gitlab', storage: setup.storage, versionControl: setup.versionControl }],
        audit: setup.audit,
      });
      const schema = tools.source_control_review_change_request!.inputSchema as any;
      for (const input of [
        { event: 'approve', body: `Verdict: approve\nReviewed head: ${head}\n` },
        { event: 'approve', body: `Verdict: approve\nReviewed head: ${'a'.repeat(64)}\n` },
        {
          event: 'approve',
          body: `Verdict: approve\nReviewed head: ${head}\n\nReviewed head: ${head.toUpperCase()}\n`,
        },
        { event: 'comment', body: 'Verdict: request changes\n\nFix it.' },
        { event: 'comment', body: 'Looks fine overall, one question inline.' },
      ]) {
        expect(schema.safeParse({ changeRequestId: 17, ...input }).success).toBe(true);
      }
    });

    it.each([
      ['approve', 'Verdict: approve\n\nLGTM.'],
      ['request-changes', 'Verdict: request changes\n\nFix it.'],
      ['comment', 'Verdict: request changes\n\nFix it.'],
      ['comment', 'Looks fine overall, one question inline.'],
    ])('publishes a consistent %s review', async (event, body) => {
      const { setup, run } = await submit({ event, body });
      await expect(run).resolves.toEqual({ id: 'review-1' });
      expect(setup.createReview).toHaveBeenCalledWith(expect.objectContaining({ event, body }));
    });

    it('rejects a body whose reviewed head is not the current head', async () => {
      const { setup, run } = await submit({
        event: 'approve',
        body: `Verdict: approve\nReviewed head: \`${'c'.repeat(40)}\`\n\nLGTM.`,
      });
      await expect(run).rejects.toThrow(/current change-request head/);
      expect(setup.createReview).not.toHaveBeenCalled();
    });

    it('rejects a body whose reviewed head disagrees with commitId in the schema', async () => {
      expect(
        await schemaError({
          event: 'approve',
          commitId: 'ce79aaafad',
          body: `Verdict: approve\n**Reviewed head:** ${head}\n`,
        }),
      ).toMatch(/commitId is ce79aaafad/);
    });

    it('publishes when the reviewed head matches the current head', async () => {
      const { setup, run } = await submit({
        event: 'approve',
        commitId: head,
        body: `Verdict: approve\nReviewed head: ${head.toUpperCase()}\n`,
      });
      await expect(run).resolves.toEqual({ id: 'review-1' });
      expect(setup.createReview).toHaveBeenCalledOnce();
    });

    it('pins the review to the checked head when commitId is omitted', async () => {
      const { setup, run } = await submit({ event: 'approve', body: `Verdict: approve\nReviewed head: ${head}\n` });
      await expect(run).resolves.toEqual({ id: 'review-1' });
      expect(setup.createReview).toHaveBeenCalledWith(expect.objectContaining({ commitId: head }));
    });
  });

  describe('publishing the review test check', () => {
    const head = 'cd1e5903851234567890abcdef1234567890abcd';

    async function publish(
      input: Record<string, unknown>,
      overrides: {
        publishCommitCheck?: unknown;
        pullRequest?: unknown;
        testChecksEnabled?: (input: { orgId: string; factoryProjectId: string }) => Promise<boolean>;
        boundChangeRequestId?: () => Promise<string | undefined>;
      } = {},
    ) {
      const setup = await fixture();
      const publishCommitCheck =
        'publishCommitCheck' in overrides
          ? overrides.publishCommitCheck
          : vi.fn(async () => ({
              id: '9',
              name: FACTORY_TEST_CHECK_NAME,
              headSha: head,
              status: 'success',
              url: null,
            }));
      setup.getPullRequest.mockResolvedValue(
        ('pullRequest' in overrides
          ? overrides.pullRequest
          : { id: '17', state: 'open', headSha: head, headBranch: 'factory/issue-1' }) as any,
      );
      const versionControl = { ...setup.versionControl, publishCommitCheck } as VersionControl;
      const tools = await createSourceControlTools({
        requestContext: requestContext(),
        providers: [{ id: 'gitlab', storage: setup.storage, versionControl }],
        audit: setup.audit,
        ...(overrides.testChecksEnabled ? { testChecksEnabled: overrides.testChecksEnabled } : {}),
        ...('boundChangeRequestId' in overrides
          ? overrides.boundChangeRequestId
            ? { boundChangeRequestId: overrides.boundChangeRequestId }
            : {}
          : { boundChangeRequestId: async () => '17' }),
      });
      const tool = tools.source_control_publish_test_check!;
      return {
        publishCommitCheck: publishCommitCheck as ReturnType<typeof vi.fn>,
        parse: (value: Record<string, unknown>) => (tool.inputSchema as any).safeParse(value),
        run: () =>
          (tool.execute as any)({
            changeRequestId: 17,
            headSha: head,
            status: 'success',
            title: 'All planned tests passed',
            summary: '3 commands passed',
            ...input,
          }),
      };
    }

    it('refuses to publish when the project turned test checks off', async () => {
      const testChecksEnabled = vi.fn(async () => false);
      const { run, publishCommitCheck } = await publish({}, { testChecksEnabled });
      await expect(run()).rejects.toThrow(/turned off for this Factory project/);
      expect(testChecksEnabled).toHaveBeenCalledWith({ orgId: expect.any(String), factoryProjectId: 'project-1' });
      expect(publishCommitCheck).not.toHaveBeenCalled();
    });

    it('refuses to publish on a change request other than the one the session reviews', async () => {
      const { run, publishCommitCheck } = await publish({}, { boundChangeRequestId: async () => '18' });
      await expect(run()).rejects.toThrow(/reviews change request 18, not 17/);
      expect(publishCommitCheck).not.toHaveBeenCalled();
    });

    it('refuses to publish from a session that is not Review-bound, such as a builder', async () => {
      const { run, publishCommitCheck } = await publish({}, { boundChangeRequestId: async () => undefined });
      await expect(run()).rejects.toThrow(/Only a Review session bound to this change request/);
      expect(publishCommitCheck).not.toHaveBeenCalled();
    });

    it('refuses to publish when the host cannot say which change request the session reviews', async () => {
      const { run, publishCommitCheck } = await publish({}, { boundChangeRequestId: undefined });
      await expect(run()).rejects.toThrow(/Only a Review session bound to this change request/);
      expect(publishCommitCheck).not.toHaveBeenCalled();
    });

    it('publishes on the change request the session reviews', async () => {
      const { run } = await publish({}, { boundChangeRequestId: async () => '17' });
      await expect(run()).resolves.toMatchObject({ id: '9' });
    });

    it('publishes when the project keeps test checks on', async () => {
      const { run, publishCommitCheck } = await publish({}, { testChecksEnabled: async () => true });
      await expect(run()).resolves.toMatchObject({ id: '9' });
      expect(publishCommitCheck).toHaveBeenCalledOnce();
    });

    it('publishes under the fixed Factory check name on the current head', async () => {
      const { run, publishCommitCheck } = await publish({ headSha: head.toUpperCase(), details: '| cmd | ok |' });
      await expect(run()).resolves.toMatchObject({ id: '9', name: FACTORY_TEST_CHECK_NAME });
      expect(publishCommitCheck).toHaveBeenCalledWith({
        connection: { type: 'oauth', accessToken: 'server-opaque-connection' },
        sourceId: 'acme/repo',
        actingUserId: 'user-1',
        headSha: head,
        ref: 'factory/issue-1',
        name: FACTORY_TEST_CHECK_NAME,
        status: 'success',
        title: 'All planned tests passed',
        summary: '3 commands passed',
        details: '| cmd | ok |',
      });
    });

    it('does not let the agent choose the check name', async () => {
      const { parse } = await publish({});
      const parsed = parse({
        changeRequestId: 17,
        headSha: head,
        status: 'success',
        title: 't',
        summary: 's',
        name: 'CI',
      });
      expect(parsed.success).toBe(true);
      expect(parsed.data).not.toHaveProperty('name');
    });

    it('rejects an abbreviated head SHA in the schema', async () => {
      const { parse } = await publish({});
      expect(
        parse({ changeRequestId: 17, headSha: 'cd1e590', status: 'success', title: 't', summary: 's' }).success,
      ).toBe(false);
    });

    it('refuses to publish for a head that is no longer current', async () => {
      const { run, publishCommitCheck } = await publish(
        {},
        { pullRequest: { id: '17', state: 'open', headSha: 'f'.repeat(40) } },
      );
      await expect(run()).rejects.toThrow(/not the current change-request head/);
      expect(publishCommitCheck).not.toHaveBeenCalled();
    });

    it('refuses to publish on a closed change request', async () => {
      const { run, publishCommitCheck } = await publish(
        {},
        { pullRequest: { id: '17', state: 'closed', headSha: head } },
      );
      await expect(run()).rejects.toThrow(/is not open/);
      expect(publishCommitCheck).not.toHaveBeenCalled();
    });

    it('reports providers that cannot publish commit checks', async () => {
      const { run } = await publish({}, { publishCommitCheck: undefined });
      await expect(run()).rejects.toThrow('gitlab does not support publishing commit checks; nothing was published.');
    });
  });
});

describe.each(['github', 'gitlab'])('source_control_push_branch with real Git (%s)', provider => {
  const roots: string[] = [];
  const branch = 'factory/issue-1';

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  async function checkoutFixture(repository: string) {
    const setup = await fixture(provider);
    const root = mkdtempSync(path.join(os.tmpdir(), 'factory-push-'));
    roots.push(root);
    const origin = path.join(root, 'origin.git');
    const checkout = path.join(root, repository.split('/')[1]!);
    const cloneUrl = `https://${provider}.com/${repository}.git`;
    const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
    const git = (...args: string[]) =>
      execFileSync('git', ['-C', checkout, ...args], {
        encoding: 'utf8',
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    execFileSync('git', ['init', '--bare', '--initial-branch=main', origin], { env, stdio: 'pipe' });
    execFileSync('git', ['init', '--initial-branch=main', checkout], { env, stdio: 'pipe' });
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.com');
    git('remote', 'add', 'origin', cloneUrl);
    // Keep provider checkout validation real, but push to a hermetic local remote.
    git('remote', 'set-url', '--push', 'origin', origin);
    const commit = (text: string) => {
      writeFileSync(path.join(checkout, 'tracked.txt'), text);
      git('add', 'tracked.txt');
      git('commit', '-m', text);
      return git('rev-parse', 'HEAD');
    };
    const base = commit('base');
    git('push', 'origin', 'main');
    setup.getRepositoryAccess.mockResolvedValue({
      cloneUrl,
      authorization: { scheme: 'bearer', token: 'test-token', username: 'test' },
    });
    const built = await createSourceControlTools({
      requestContext: requestContext(),
      providers: [{ id: provider, storage: setup.storage, versionControl: setup.versionControl }],
      audit: setup.audit,
    });
    const hooks: { afterCommand?: (args: string[]) => void } = {};
    const sandbox = {
      id: 'real-git',
      provider: 'custom',
      workingDirectory: root,
      async executeCommand(command: string, args: string[] = [], options?: { env?: Record<string, string> }) {
        const result = spawnSync(command, args, {
          encoding: 'utf8',
          env: { ...env, ...options?.env },
          timeout: 10_000,
        });
        if (result.error) throw result.error;
        hooks.afterCommand?.(args);
        return { exitCode: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
      },
    };
    const push = () =>
      (built.source_control_push_branch!.execute as any)(repository === 'acme/repo' ? {} : { repository }, {
        workspace: { sandbox },
      });
    const remote = (...args: string[]) => git('--git-dir', origin, ...args);
    return { ...setup, root, checkout, git, commit, base, push, remote, hooks };
  }

  describe.each(['acme/repo', 'acme/other'])('%s', repository => {
    // A session ref left at the base used to push no agent commits. (#27667)
    it('pushes the active commit from an existing stale session branch without losing dirty work', async () => {
      const { checkout, git, commit, base, push, remote } = await checkoutFixture(repository);
      git('branch', branch);
      git('switch', '-c', 'agent-work');
      const head = commit('agent change');
      writeFileSync(path.join(checkout, 'staged.txt'), 'staged work');
      git('add', 'staged.txt');
      writeFileSync(path.join(checkout, 'tracked.txt'), 'unstaged work');
      writeFileSync(path.join(checkout, 'untracked.txt'), 'untracked work');
      const status = git('status', '--porcelain');
      const diff = git('diff');
      const staged = git('diff', '--cached');

      await push();

      expect(remote('rev-parse', `refs/heads/${branch}`)).toBe(head);
      expect(remote('show', `${branch}:tracked.txt`)).toBe('agent change');
      expect(git('symbolic-ref', '--short', 'HEAD')).toBe(branch);
      expect(git('rev-parse', 'main')).toBe(base);
      expect(git('rev-parse', 'agent-work')).toBe(head);
      expect(git('status', '--porcelain')).toBe(status);
      expect(git('diff')).toBe(diff);
      expect(git('diff', '--cached')).toBe(staged);
    });

    it.each(['missing', 'same-tip', 'detached'])('keeps subsequent commits on the session branch (%s)', async state => {
      const { git, commit, push, remote } = await checkoutFixture(repository);
      if (state !== 'missing') git('branch', branch);
      if (state === 'detached') git('switch', '--detach');
      await push();
      expect(git('symbolic-ref', '--short', 'HEAD')).toBe(branch);
      const next = commit('next change');
      await push();
      expect(remote('rev-parse', `refs/heads/${branch}`)).toBe(next);
    });

    it('pushes an ahead session branch without moving the active checkout', async () => {
      const { checkout, git, commit, base, push, remote, storage } = await checkoutFixture(repository);
      git('switch', '-c', branch);
      const sessionHead = commit('session work');
      git('switch', 'main');
      writeFileSync(path.join(checkout, 'tracked.txt'), 'uncommitted main work');
      const dirty = git('status', '--porcelain');

      await expect(push()).resolves.toEqual({ pushed: true, branch, repository });

      expect(remote('rev-parse', `refs/heads/${branch}`)).toBe(sessionHead);
      expect(remote('show', `${branch}:tracked.txt`)).toBe('session work');
      expect(git('rev-parse', branch)).toBe(sessionHead);
      expect(git('rev-parse', 'HEAD')).toBe(base);
      expect(git('symbolic-ref', '--short', 'HEAD')).toBe('main');
      expect(git('status', '--porcelain')).toBe(dirty);
      expect(git('diff')).toContain('+uncommitted main work');
      expect(await storage.sessionRepositories.listBySession({ sessionId: 'session-1' })).toMatchObject([{ branch }]);
    });

    it('refuses to discard divergent session commits or publish a stale ref', async () => {
      const { git, commit, push, remote, storage } = await checkoutFixture(repository);
      git('switch', '-c', branch);
      const sessionHead = commit('session work');
      git('switch', 'main');
      const activeHead = commit('other work');

      await expect(push()).rejects.toMatchObject({ code: 'push-failed' });

      expect(git('rev-parse', branch)).toBe(sessionHead);
      expect(git('rev-parse', 'HEAD')).toBe(activeHead);
      expect(git('symbolic-ref', '--short', 'HEAD')).toBe('main');
      expect(remote('for-each-ref', '--format=%(refname)', `refs/heads/${branch}`)).toBe('');
      expect(await storage.sessionRepositories.listBySession({ sessionId: 'session-1' })).toEqual([]);
    });

    it.each(['--is-ancestor', '--porcelain'])(
      'preserves concurrent session commits and refuses to publish after %s',
      async checkpoint => {
        const { git, commit, base, push, remote, storage, hooks } = await checkoutFixture(repository);
        git('branch', branch);
        const activeHead = commit('active work');
        const concurrentHead = git('commit-tree', 'HEAD^{tree}', '-p', base, '-m', 'concurrent session work');
        // Schedule a real ref update between validation and materialization. (#27667)
        hooks.afterCommand = args => {
          if (args.includes(checkpoint)) {
            git('update-ref', `refs/heads/${branch}`, concurrentHead, base);
            hooks.afterCommand = undefined;
          }
        };

        const outcome = await push().catch((error: unknown) => error);

        expect(git('rev-parse', branch)).toBe(concurrentHead);
        expect(outcome).toMatchObject({ code: 'push-failed' });
        expect(git('rev-parse', 'HEAD')).toBe(activeHead);
        expect(git('symbolic-ref', '--short', 'HEAD')).toBe('main');
        expect(remote('for-each-ref', '--format=%(refname)', `refs/heads/${branch}`)).toBe('');
        expect(await storage.sessionRepositories.listBySession({ sessionId: 'session-1' })).toEqual([]);
      },
    );

    it('refuses to reset a session branch checked out in another worktree', async () => {
      const { root, git, commit, base, push, remote } = await checkoutFixture(repository);
      git('branch', branch);
      git('worktree', 'add', path.join(root, 'other-worktree'), branch);
      const head = commit('active work');
      await expect(push()).rejects.toMatchObject({ code: 'push-failed' });
      expect(git('rev-parse', branch)).toBe(base);
      expect(git('rev-parse', 'HEAD')).toBe(head);
      expect(remote('for-each-ref', '--format=%(refname)', `refs/heads/${branch}`)).toBe('');
    });
  });
});
