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
    integrationId?: string;
    type?: string;
    externalId?: string;
    url?: string;
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
          type: options.type ?? 'pull-request',
          externalId: options.externalId ?? 'github-pr:42',
          ...(options.url ? { url: options.url } : {}),
        },
        title: 'Review card',
        stages: ['review'],
        sessions: {},
        metadata: {
          authorTrusted: true,
          ...(options.author ? { author: options.author } : {}),
        },
      },
    },
    role: options.role ?? 'review',
    session: { sessionId: 'resource-1', branch: 'factory/review', threadId: 'thread-1' },
    resourceId: 'resource-1',
    kickoffKey: 'kickoff-review',
    kickoffMessage: null,
  });
}

describe('factory_review_source', () => {
  it('returns the session URL, PR author, and review target for a review-bound session', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareReviewItem(storage, {
      author: 'octocat',
      url: 'https://github.com/acme/repo/pull/42',
    });

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
        url: 'https://github.com/acme/repo/pull/42',
      },
    });
  });

  it('returns reviewTarget.url null when the review card was intake-recorded without a url', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    // Mirror a GitLab MR card whose intake stored no `url` — the skill's
    // fallback rule (cross-check on externalId when url is null) depends on
    // the tool exposing null here rather than an empty string.
    await prepareReviewItem(storage, {
      integrationId: 'gitlab',
      type: 'merge-request',
      externalId: 'gitlab-pr:aGVsbG8=',
    });
    const context = requestContext();
    const tools = await createReviewSourceTool({
      requestContext: context,
      storage,
      uiOrigin: PUBLIC_ORIGIN,
    });
    const output = (await (tools.factory_review_source as ExecutableTool).execute(
      {},
      { requestContext: context, agent: { toolCallId: 'tc-1' } },
    )) as { reviewTarget: { integrationId: string; url: string | null } };
    expect(output.reviewTarget).toEqual({
      integrationId: 'gitlab',
      type: 'merge-request',
      externalId: 'gitlab-pr:aGVsbG8=',
      url: null,
    });
  });

  it('returns triggeredBy null when the metadata does not carry an author', async () => {
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
    };
    expect(output.triggeredBy).toBeNull();
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

  it('is not offered when the UI origin is unset — matches Slack, which omits the deep-link rather than falling back to the API origin', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareReviewItem(storage, { author: 'octocat' });
    const context = requestContext();
    const tools = await createReviewSourceTool({
      requestContext: context,
      storage,
      uiOrigin: null,
    });
    expect(tools.factory_review_source).toBeUndefined();
  });

  it('strips a trailing slash from the UI origin when constructing the session URL', async () => {
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

  it('resolves the binding through findActiveRunBinding when the request-context address short-circuits without one', async () => {
    // Common case: request-context state already carries `factoryProjectId`,
    // so `resolveFactorySessionAddress` short-circuits with an address but no
    // binding. The tool then falls back to `findActiveRunBinding(address)` to
    // pick up the review-role binding recorded against the review card. This
    // path is exercised silently by every other test — this test pins it as
    // required behavior by asserting the storage method is what actually
    // supplied the binding.
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareReviewItem(storage, {
      author: 'octocat',
      url: 'https://github.com/acme/repo/pull/42',
    });

    let addressLookupCalls = 0;
    const wrapped: Pick<WorkItemsStorage, 'findActiveRunBindingByThread' | 'findActiveRunBinding' | 'get'> = {
      // The state short-circuit means this must never be hit; if it is, the
      // fallback semantics changed and this assertion catches it.
      findActiveRunBindingByThread: async () => {
        throw new Error('unexpected: findActiveRunBindingByThread called on short-circuit path');
      },
      findActiveRunBinding: async input => {
        addressLookupCalls += 1;
        return storage.findActiveRunBinding(input);
      },
      get: storage.get.bind(storage),
    };

    const context = requestContext();
    const tools = await createReviewSourceTool({
      requestContext: context,
      storage: wrapped,
      uiOrigin: PUBLIC_ORIGIN,
    });
    const tool = tools.factory_review_source as ExecutableTool | undefined;
    expect(tool).toBeDefined();
    expect(addressLookupCalls).toBe(1);
    const output = (await tool!.execute({}, { requestContext: context, agent: { toolCallId: 'tc-1' } })) as {
      sessionUrl: string;
      triggeredBy: string | null;
      reviewTarget: { integrationId: string; url: string | null };
    };
    expect(output.triggeredBy).toBe('octocat');
    expect(output.reviewTarget.integrationId).toBe('github');
    expect(output.reviewTarget.url).toBe('https://github.com/acme/repo/pull/42');
    expect(output.sessionUrl).toBe(
      `${PUBLIC_ORIGIN}/factories/${encodeURIComponent(PROJECT_ID)}/workspaces/resource-1/threads/thread-1`,
    );
  });
});
