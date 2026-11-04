import { describe, expect, it } from 'vitest';
import { WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { recordPullRequestHead } from './pull-request-head.js';

function storageWith(cards: Array<Record<string, unknown>>) {
  const reads = [...cards];
  const writes: Array<Record<string, unknown>> = [];
  const storage = {
    get: async () => reads.shift(),
    update: async (input: Record<string, unknown>) => {
      writes.push(input);
      if (writes.length === 1 && reads.length > 0) throw new WorkItemUpdateConflictError('revision');
      return {};
    },
  } as unknown as WorkItemsStorage;
  return { storage, writes };
}

describe('recordPullRequestHead', () => {
  it('rechecks the newer head a concurrent delivery wrote before retrying', async () => {
    const { storage, writes } = storageWith([
      { orgId: 'org-1', id: 'card', revision: 1, metadata: {} },
      { orgId: 'org-1', id: 'card', revision: 2, metadata: { pullRequestHeadSha: 'b', pullRequestHeadAt: 300 } },
    ]);

    await recordPullRequestHead(storage, { orgId: 'org-1', id: 'card', headSha: 'a', headAt: 200 });

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ expectedRevision: 1 });
  });

  it('rechecks ownership after the card moved on to another pull request', async () => {
    const { storage, writes } = storageWith([
      { orgId: 'org-1', id: 'card', revision: 1, metadata: { openPullRequestNumber: 17 } },
      { orgId: 'org-1', id: 'card', revision: 2, metadata: { openPullRequestNumber: 18 } },
    ]);

    await recordPullRequestHead(storage, {
      orgId: 'org-1',
      id: 'card',
      headSha: 'a',
      headAt: 200,
      ownedPullRequestNumber: 17,
    });

    expect(writes).toHaveLength(1);
  });
});
