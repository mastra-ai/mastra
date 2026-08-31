/**
 * Delivery records: the claim is what keeps two replicas from posting the same
 * comment, and what makes a dead process recover instead of losing the post.
 */

import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';
import { MAX_MIRROR_ATTEMPTS, mirrorBackoffMs } from './mirrors.js';

type Seed = Awaited<ReturnType<typeof createFactoryStorageForTests>>;

const owed = {
  orgId: 'org-1',
  factoryProjectId: 'project-1',
  workItemId: 'item-1',
  commentId: 'comment-1',
  publisherId: 'slack',
};

async function seedMirror(seed: Seed, now = new Date()) {
  const row = await seed.commentMirrors.enqueue(owed, now);
  if (!row) throw new Error('expected a fresh delivery');
  return row;
}

describe('CommentMirrorsStorage', () => {
  it('owes a comment to a platform once, however many times the create is replayed', async () => {
    const seed = await createFactoryStorageForTests();

    const first = await seed.commentMirrors.enqueue(owed);
    const replay = await seed.commentMirrors.enqueue(owed);

    expect(first).not.toBeNull();
    expect(replay).toBeNull();
  });

  it('lets one replica claim a delivery and leaves the other with nothing to post', async () => {
    const seed = await createFactoryStorageForTests();
    const row = await seedMirror(seed);

    const [winner, loser] = await Promise.all([seed.commentMirrors.claim(row.id), seed.commentMirrors.claim(row.id)]);

    expect([winner, loser].filter(Boolean)).toHaveLength(1);
  });

  it('brings a claim that never landed back around instead of stranding it', async () => {
    const seed = await createFactoryStorageForTests();
    const row = await seedMirror(seed);
    const claimedAt = new Date();

    // The process holding this claim dies here — nothing settles the row.
    await seed.commentMirrors.claim(row.id, claimedAt);

    expect(await seed.commentMirrors.listDue(10, claimedAt)).toEqual([]);
    const afterBackoff = new Date(claimedAt.getTime() + mirrorBackoffMs(1) + 1);
    expect(await seed.commentMirrors.listDue(10, afterBackoff)).toHaveLength(1);
  });

  it('gives up on a delivery once its attempts are spent', async () => {
    const seed = await createFactoryStorageForTests();
    const row = await seedMirror(seed);

    let at = new Date();
    for (let attempt = 0; attempt < MAX_MIRROR_ATTEMPTS; attempt++) {
      const claim = await seed.commentMirrors.claim(row.id, at);
      expect(claim).not.toBeNull();
      await seed.commentMirrors.recordFailure(row.id, new Error('slack is down'), at);
      at = new Date(at.getTime() + mirrorBackoffMs(attempt + 1) + 1);
    }

    const [state] = [...(await seed.commentMirrors.listForComments('org-1', ['comment-1'])).values()].flat();
    expect(state).toMatchObject({ status: 'failed', lastError: 'slack is down' });
    expect(await seed.commentMirrors.listDue(10, at)).toEqual([]);
  });

  it('stops reading a delivered comment as owed', async () => {
    const seed = await createFactoryStorageForTests();
    const row = await seedMirror(seed);

    await seed.commentMirrors.claim(row.id);
    await seed.commentMirrors.settle(row.id, true);

    const byComment = await seed.commentMirrors.listForComments('org-1', ['comment-1']);
    expect(byComment.get('comment-1')?.[0]?.status).toBe('delivered');
    expect(await seed.commentMirrors.listDue(10, new Date(Date.now() + 3_600_000))).toEqual([]);
  });

  it('keeps another org out of the delivery state it reads back', async () => {
    const seed = await createFactoryStorageForTests();
    await seedMirror(seed);

    expect(await seed.commentMirrors.listForComments('org-2', ['comment-1'])).toEqual(new Map());
  });
});
