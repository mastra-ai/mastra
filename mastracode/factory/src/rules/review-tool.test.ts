import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createFactoryReviewTools } from './review-tool.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const PR_URL = 'https://github.com/acme/app/pull/7';

type ExecutableTool = {
  execute: (input: unknown, context: unknown) => Promise<{ event: string; url: string | null; body: string }>;
};

function requestContext(modelId: string) {
  const context = new RequestContext();
  context.set('user', { workosId: 'user-1', organizationId: 'org-1' });
  context.set('controller', {
    resourceId: 'resource-1',
    threadId: 'thread-1',
    scope: '/worktree',
    session: { id: 'session-1', ownerId: 'code', modeId: 'review', modelId },
    getState: () => ({ factoryProjectId: PROJECT_ID }),
  });
  return context;
}

async function bindReviewItem(storage: WorkItemsStorage, type: 'pull-request' | 'issue' = 'pull-request') {
  return storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      input: {
        externalSource: {
          integrationId: 'github',
          type,
          externalId: type === 'pull-request' ? 'github-pr:7' : 'github-issue:7',
          ...(type === 'pull-request' ? { url: PR_URL } : {}),
        },
        title: 'Factory item',
        stages: ['review'],
        sessions: {},
        metadata: {},
      },
    },
    role: 'review',
    session: { sessionId: 'resource-1', branch: 'factory/item', threadId: 'thread-1' },
    resourceId: 'resource-1',
    kickoffKey: 'kickoff-1',
    kickoffMessage: null,
  });
}

function publisher(result: { url: string | null; event: 'approve' | 'request-changes' | 'comment' }) {
  return { publish: vi.fn().mockResolvedValue(result) };
}

const APPROVE = {
  verdict: 'approve',
  verification: [{ command: 'pnpm test', outcome: 'pass' }],
  adversarialCheck: 'The damaging reading does not survive the covered path.',
};

describe('factory_publish_review', () => {
  it('publishes the verdict with a body composed here', async () => {
    const { workItems } = await createFactoryStorageForTests();
    await bindReviewItem(workItems);
    const publish = publisher({ url: 'https://github.com/acme/app/pull/7#review', event: 'approve' });

    const tools = await createFactoryReviewTools({
      requestContext: requestContext('anthropic/claude-opus-5'),
      storage: workItems,
      publisher: publish,
    });
    const result = await (tools.factory_publish_review as unknown as ExecutableTool).execute(APPROVE, {
      requestContext: requestContext('anthropic/claude-opus-5'),
    });

    expect(publish.publish).toHaveBeenCalledWith(
      expect.objectContaining({ verdict: 'approve', orgId: 'org-1', factoryProjectId: PROJECT_ID }),
    );
    expect(result.body).toContain('Verdict: approve');
    expect(result.event).toBe('approve');
  });

  // A re-review runs in the same thread after the pass closed its binding, and
  // published the previous pass's model because the runtime was read once.
  it('attributes a re-review to the model running it, not the one that ran before', async () => {
    const { workItems } = await createFactoryStorageForTests();
    const prepared = await bindReviewItem(workItems);
    const publish = publisher({ url: null, event: 'approve' });

    const tools = await createFactoryReviewTools({
      requestContext: requestContext('anthropic/claude-opus-4-8'),
      storage: workItems,
      publisher: publish,
    });
    await workItems.revokeRunBinding({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      bindingId: prepared.binding.id,
      revokedAt: new Date(),
    });

    const result = await (tools.factory_publish_review as unknown as ExecutableTool).execute(APPROVE, {
      requestContext: requestContext('anthropic/claude-opus-5'),
    });

    expect(result.body).toContain('Review runtime: anthropic/claude-opus-5');
    expect(result.body).not.toContain('opus-4-8');
  });

  it('stays unregistered for a work item that tracks no pull request', async () => {
    const { workItems } = await createFactoryStorageForTests();
    await bindReviewItem(workItems, 'issue');

    const tools = await createFactoryReviewTools({
      requestContext: requestContext('anthropic/claude-opus-5'),
      storage: workItems,
      publisher: publisher({ url: null, event: 'comment' }),
    });

    expect(tools.factory_publish_review).toBeUndefined();
  });
});
