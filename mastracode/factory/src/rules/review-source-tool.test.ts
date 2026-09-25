import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createReviewSourceTool } from './review-source-tool.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const PUBLIC_ORIGIN = 'https://factory.example.com';

type ExecutableTool = {
  execute: (input: unknown, context: unknown) => Promise<unknown>;
  inputSchema: { safeParse: (input: unknown) => { success: boolean } };
};

function requestContext(overrides: Partial<{ threadId: string; resourceId: string }> = {}) {
  const context = new RequestContext();
  context.set('user', { workosId: 'user-1', organizationId: 'org-1' });
  context.set('controller', {
    resourceId: overrides.resourceId ?? 'resource-1',
    threadId: overrides.threadId ?? 'thread-1',
    scope: '/worktree',
    session: { id: 'session-1', ownerId: 'code', modeId: 'build' },
    getState: () => ({ factoryProjectId: PROJECT_ID }),
  });
  return context;
}

async function prepareReviewItem(
  storage: WorkItemsStorage,
  options: {
    author?: string;
    parentWorkItemId?: string;
    integrationId?: string;
    externalId?: string;
    role?: 'review' | 'work' | 'plan' | 'triage';
  } = {},
) {
  return storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      input: {
        externalSource: {
          integrationId: options.integrationId ?? 'github',
          type: 'pull-request',
          externalId: options.externalId ?? 'github-pr:42',
        },
        title: 'Review card',
        stages: ['review'],
        sessions: {},
        metadata: {
          authorTrusted: true,
          ...(options.author ? { author: options.author } : {}),
        },
        ...(options.parentWorkItemId ? { parentWorkItemId: options.parentWorkItemId } : {}),
      },
    },
    role: options.role ?? 'review',
    session: { sessionId: 'resource-1', branch: 'factory/review', threadId: 'thread-1' },
    resourceId: 'resource-1',
    kickoffKey: 'kickoff-review',
    kickoffMessage: null,
  });
}

async function prepareLinearParent(
  storage: WorkItemsStorage,
  options: { url: string; identifier: string; parentWorkItemId?: string },
) {
  return storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      input: {
        externalSource: {
          integrationId: 'linear',
          type: 'issue',
          externalId: `linear:${options.identifier}`,
          url: options.url,
        },
        title: `${options.identifier}: Upstream`,
        stages: ['done'],
        sessions: {},
        metadata: { source: 'linear-issue' },
        ...(options.parentWorkItemId ? { parentWorkItemId: options.parentWorkItemId } : {}),
      },
    },
    role: 'work',
    session: {
      sessionId: `resource-parent-${options.identifier}`,
      branch: 'main',
      threadId: `thread-${options.identifier}`,
    },
    resourceId: `resource-parent-${options.identifier}`,
    kickoffKey: `kickoff-parent-${options.identifier}`,
    kickoffMessage: null,
  });
}

describe('factory_review_source', () => {
  it('reports the session URL, PR author, and linked Linear issue for a review-bound session', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const linearParent = await prepareLinearParent(storage, {
      url: 'https://linear.app/acme/issue/ACME-42/build-a-thing',
      identifier: 'ACME-42',
    });
    await prepareReviewItem(storage, { author: 'octocat', parentWorkItemId: linearParent.item.id });

    const context = requestContext();
    const tools = await createReviewSourceTool({
      requestContext: context,
      storage,
      uiOrigin: PUBLIC_ORIGIN,
    });
    const tool = tools.factory_review_source as ExecutableTool | undefined;
    expect(tool).toBeDefined();
    const output = await tool!.execute({}, { requestContext: context, agent: { toolCallId: 'tc-1' } });
    expect(output).toEqual({
      sessionUrl: `${PUBLIC_ORIGIN}/factories/${encodeURIComponent(PROJECT_ID)}/workspaces/resource-1/threads/thread-1`,
      triggeredBy: 'octocat',
      reviewTarget: {
        integrationId: 'github',
        type: 'pull-request',
        externalId: 'github-pr:42',
        url: null,
      },
      linkedIssues: [{ source: 'linear', url: 'https://linear.app/acme/issue/ACME-42/build-a-thing' }],
    });
  });

  it('returns triggeredBy null and empty linkedIssues when the metadata does not carry them', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareReviewItem(storage);
    const context = requestContext();
    const tools = await createReviewSourceTool({
      requestContext: context,
      storage,
      uiOrigin: PUBLIC_ORIGIN,
    });
    const tool = tools.factory_review_source as ExecutableTool;
    const output = (await tool.execute({}, { requestContext: context, agent: { toolCallId: 'tc-1' } })) as {
      triggeredBy: string | null;
      linkedIssues: unknown[];
    };
    expect(output.triggeredBy).toBeNull();
    expect(output.linkedIssues).toEqual([]);
  });

  it('detects a Jira parent issue URL', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const jiraParent = await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        input: {
          externalSource: {
            integrationId: 'jira',
            type: 'issue',
            externalId: 'jira:ENG-7',
            url: 'https://acme.atlassian.net/browse/ENG-7',
          },
          title: 'ENG-7',
          stages: ['done'],
          sessions: {},
        },
      },
      role: 'work',
      session: { sessionId: 'resource-jira', branch: 'main', threadId: 'thread-jira' },
      resourceId: 'resource-jira',
      kickoffKey: 'kickoff-jira',
      kickoffMessage: null,
    });
    await prepareReviewItem(storage, { author: 'octocat', parentWorkItemId: jiraParent.item.id });
    const context = requestContext();
    const tools = await createReviewSourceTool({
      requestContext: context,
      storage,
      uiOrigin: PUBLIC_ORIGIN,
    });
    const output = (await (tools.factory_review_source as ExecutableTool).execute(
      {},
      { requestContext: context, agent: { toolCallId: 'tc-1' } },
    )) as { linkedIssues: { source: string; url: string }[] };
    expect(output.linkedIssues).toEqual([{ source: 'jira', url: 'https://acme.atlassian.net/browse/ENG-7' }]);
  });

  it('is not offered on non-review sessions', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareReviewItem(storage, { role: 'work', externalId: 'github-issue:99' });
    const context = requestContext();
    const tools = await createReviewSourceTool({
      requestContext: context,
      storage,
      uiOrigin: PUBLIC_ORIGIN,
    });
    expect(tools.factory_review_source).toBeUndefined();
  });

  it('strips a trailing slash from the public origin when constructing the session URL', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareReviewItem(storage, { author: 'octocat' });
    const context = requestContext();
    const tools = await createReviewSourceTool({
      requestContext: context,
      storage,
      uiOrigin: `${PUBLIC_ORIGIN}/`,
    });
    const output = (await (tools.factory_review_source as ExecutableTool).execute(
      {},
      { requestContext: context, agent: { toolCallId: 'tc-1' } },
    )) as { sessionUrl: string };
    expect(output.sessionUrl.startsWith(`${PUBLIC_ORIGIN}/factories/`)).toBe(true);
    expect(output.sessionUrl).not.toContain('//factories');
  });

  it('ignores unrelated parent URLs that do not match the linear or jira issue shape', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const wrongParent = await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        input: {
          externalSource: {
            integrationId: 'linear',
            type: 'comment',
            externalId: 'linear:comment:1',
            url: 'https://linear.app/acme/comment/xyz',
          },
          title: 'Not an issue',
          stages: ['done'],
          sessions: {},
        },
      },
      role: 'work',
      session: { sessionId: 'resource-wrong', branch: 'main', threadId: 'thread-wrong' },
      resourceId: 'resource-wrong',
      kickoffKey: 'kickoff-wrong',
      kickoffMessage: null,
    });
    await prepareReviewItem(storage, { parentWorkItemId: wrongParent.item.id });
    const context = requestContext();
    const tools = await createReviewSourceTool({
      requestContext: context,
      storage,
      uiOrigin: PUBLIC_ORIGIN,
    });
    const output = (await (tools.factory_review_source as ExecutableTool).execute(
      {},
      { requestContext: context, agent: { toolCallId: 'tc-1' } },
    )) as { linkedIssues: unknown[] };
    expect(output.linkedIssues).toEqual([]);
  });

  it('propagates storage failures while walking parent work items instead of returning partial results', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const linearParent = await prepareLinearParent(storage, {
      url: 'https://linear.app/acme/issue/ACME-42/build-a-thing',
      identifier: 'ACME-42',
    });
    await prepareReviewItem(storage, { author: 'octocat', parentWorkItemId: linearParent.item.id });

    // Wrap the real storage so parent lookups blow up while the initial review
    // item read still succeeds. The tool must surface the error, not silently
    // return an empty or partial `linkedIssues` list.
    const brokenStorage: Pick<WorkItemsStorage, 'findActiveRunBindingByThread' | 'findActiveRunBinding' | 'get'> = {
      findActiveRunBindingByThread: storage.findActiveRunBindingByThread.bind(storage),
      findActiveRunBinding: storage.findActiveRunBinding.bind(storage),
      get: async input => {
        if (input.id === linearParent.item.id) {
          throw new Error('boom: storage unavailable');
        }
        return storage.get(input);
      },
    };

    const context = requestContext();
    const tools = await createReviewSourceTool({
      requestContext: context,
      storage: brokenStorage,
      uiOrigin: PUBLIC_ORIGIN,
    });
    const tool = tools.factory_review_source as ExecutableTool;
    await expect(tool.execute({}, { requestContext: context, agent: { toolCallId: 'tc-1' } })).rejects.toThrow(
      /boom: storage unavailable/,
    );
  });
});
