/**
 * Comments storage over a real backend (libsql `:memory:`): feed keyset
 * ordering, source-key idempotency, mention join maintenance, and the
 * recount-based work-item counters.
 */

import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';
import type { FactoryActorRef } from './actor.js';
import { supersedesFeedActivity } from './base.js';

const scope = { orgId: 'org-1', factoryProjectId: 'project-1', workItemId: 'item-1' };

const alice: FactoryActorRef = {
  kind: 'user',
  id: 'user-alice',
  displayName: 'Alice',
  avatarUrl: 'https://avatars.example/alice.png',
};
const bob: FactoryActorRef = { kind: 'user', id: 'user-bob', displayName: 'Bob' };

describe('WorkItemCommentsStorage', () => {
  it('round-trips a comment including the flattened author and reply columns', async () => {
    const seed = await createFactoryStorageForTests();
    const parent = await seed.comments.create({ ...scope, author: bob, body: 'original take' });
    const created = await seed.comments.create({
      ...scope,
      author: alice,
      body: 'I disagree, see the trace',
      replyTo: { commentId: parent.id, quote: 'original take', authorId: bob.id, authorName: 'Bob' },
      mentions: [{ kind: 'user', id: bob.id }],
    });

    const fetched = await seed.comments.get({ orgId: scope.orgId, commentId: created.id });
    expect(fetched).toMatchObject({
      body: 'I disagree, see the trace',
      bodyFormat: 'markdown',
      kind: 'comment',
      author: { kind: 'user', id: 'user-alice', displayName: 'Alice', avatarUrl: 'https://avatars.example/alice.png' },
      replyTo: { commentId: parent.id, quote: 'original take', authorId: 'user-bob', authorName: 'Bob' },
      mentions: [{ kind: 'user', id: 'user-bob' }],
      deletedAt: null,
      revision: 1,
    });
  });

  it('pages newest-first across a tied-timestamp boundary without skips or duplicates', async () => {
    const seed = await createFactoryStorageForTests();
    const tied = new Date('2026-08-01T10:00:00.000Z');
    const ids = [];
    for (let i = 0; i < 3; i++) {
      ids.push((await seed.comments.create({ ...scope, author: alice, body: `tied ${i}`, occurredAt: tied })).id);
    }

    const first = await seed.comments.list({ ...scope, limit: 2 });
    expect(first.comments).toHaveLength(2);
    expect(first.nextCursor).toBeDefined();
    const second = await seed.comments.list({ ...scope, limit: 2, before: first.nextCursor });
    expect(second.comments).toHaveLength(1);
    expect(second.nextCursor).toBeUndefined();

    const seen = [...first.comments, ...second.comments].map(comment => comment.id);
    expect(new Set(seen).size).toBe(3);
    expect(new Set(ids)).toEqual(new Set(seen));
  });

  it('anchors a page on a deep-linked comment, holding it and everything newer', async () => {
    const seed = await createFactoryStorageForTests();
    const ids = [];
    for (let i = 0; i < 5; i++) {
      ids.push(
        (
          await seed.comments.create({
            ...scope,
            author: alice,
            body: `comment ${i}`,
            occurredAt: new Date(`2026-08-0${i + 1}T10:00:00.000Z`),
          })
        ).id,
      );
    }

    const page = await seed.comments.list({ ...scope, limit: 2, around: ids[1] });
    // The limit never truncates the anchor away: the target plus its three newer.
    expect(page.comments.map(comment => comment.body)).toEqual(['comment 4', 'comment 3', 'comment 2', 'comment 1']);
    const older = await seed.comments.list({ ...scope, before: page.nextCursor });
    expect(older.comments.map(comment => comment.body)).toEqual(['comment 0']);
  });

  it('drops the anchor for the oldest comment and for one that does not exist', async () => {
    const seed = await createFactoryStorageForTests();
    const oldest = await seed.comments.create({
      ...scope,
      author: alice,
      body: 'oldest',
      occurredAt: new Date('2026-08-01T10:00:00.000Z'),
    });
    await seed.comments.create({
      ...scope,
      author: bob,
      body: 'newest',
      occurredAt: new Date('2026-08-02T10:00:00.000Z'),
    });

    const anchored = await seed.comments.list({ ...scope, around: oldest.id });
    expect(anchored.comments.map(comment => comment.body)).toEqual(['newest', 'oldest']);
    expect(anchored.nextCursor).toBeUndefined();

    const missing = await seed.comments.list({ ...scope, around: '00000000-0000-4000-8000-000000000000' });
    expect(missing.comments.map(comment => comment.body)).toEqual(['newest', 'oldest']);
  });

  it('orders by caller-set occurred_at, not insert time', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.comments.create({ ...scope, author: alice, body: 'posted first, happened last' });
    await seed.comments.create({
      ...scope,
      author: bob,
      body: 'backdated platform ingest',
      occurredAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    const { comments } = await seed.comments.list(scope);
    expect(comments.map(comment => comment.body)).toEqual(['posted first, happened last', 'backdated platform ingest']);
  });

  it('replays a source-keyed create without clobbering a later edit', async () => {
    const seed = await createFactoryStorageForTests();
    const token = 'client-token-0001';
    const created = await seed.comments.create({ ...scope, author: alice, body: 'hello', clientToken: token });
    await seed.comments.edit({ orgId: scope.orgId, commentId: created.id, body: 'hello, edited' });

    const replayed = await seed.comments.create({ ...scope, author: alice, body: 'hello', clientToken: token });
    expect(replayed.id).toBe(created.id);
    expect(replayed.body).toBe('hello, edited');
    expect((await seed.comments.list(scope)).comments).toHaveLength(1);
  });

  it('rejects a clientToken replay that targets another work item or author', async () => {
    const seed = await createFactoryStorageForTests();
    const token = 'client-token-0009';
    const created = await seed.comments.create({ ...scope, author: alice, body: 'on item 1', clientToken: token });

    await expect(
      seed.comments.create({ ...scope, workItemId: 'item-2', author: alice, body: 'on item 2', clientToken: token }),
    ).rejects.toThrow('Client token already used by a different comment.');
    await expect(
      seed.comments.create({ ...scope, author: bob, body: 'as someone else', clientToken: token }),
    ).rejects.toThrow('Client token already used by a different comment.');

    const replayed = await seed.comments.create({ ...scope, author: alice, body: 'on item 1', clientToken: token });
    expect(replayed.id).toBe(created.id);
    expect((await seed.comments.list(scope)).comments).toHaveLength(1);
  });

  it('stamps a mention added by editing with the edit time, not the comment time', async () => {
    const seed = await createFactoryStorageForTests();
    const created = await seed.comments.create({
      ...scope,
      author: alice,
      body: 'old comment',
      occurredAt: new Date('2026-08-01T10:00:00.000Z'),
    });

    const before = Date.now();
    await seed.comments.edit({
      orgId: scope.orgId,
      commentId: created.id,
      body: 'old comment @Bob',
      mentions: [{ kind: 'user', id: bob.id }],
    });

    const [mention] = await seed.comments.listMentionsForUser({ ...scope, userId: bob.id, limit: 1 });
    expect(mention?.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('write-back keeps the first external source and the local source key', async () => {
    const seed = await createFactoryStorageForTests();
    const created = await seed.comments.create({
      ...scope,
      author: alice,
      body: 'mirror me',
      clientToken: 'client-token-0010',
    });

    const slack = { integrationId: 'slack', type: 'message', externalId: 'C1:1.0' };
    const attached = await seed.comments.attachExternalSource({
      orgId: scope.orgId,
      commentId: created.id,
      source: slack,
    });
    expect(attached?.externalSource).toEqual(slack);
    expect(attached?.sourceKey).toBe('local:comment:client-token-0010');

    const second = await seed.comments.attachExternalSource({
      orgId: scope.orgId,
      commentId: created.id,
      source: { integrationId: 'linear', type: 'comment', externalId: 'L1' },
    });
    expect(second?.externalSource).toEqual(slack);
  });

  it('keeps two workspaces apart when their message ids collide on one project', async () => {
    const seed = await createFactoryStorageForTests();
    const message = { integrationId: 'slack', type: 'message', externalId: 'C1:1700.42' };

    const one = await seed.comments.create({
      ...scope,
      author: alice,
      body: 'said in the first workspace',
      externalSource: { ...message, workspaceId: 'T-one' },
    });
    const two = await seed.comments.create({
      ...scope,
      author: alice,
      body: 'said in the second workspace',
      externalSource: { ...message, workspaceId: 'T-two' },
    });

    expect(two.id).not.toBe(one.id);
    expect(two.body).toBe('said in the second workspace');
    expect((await seed.comments.list(scope)).comments).toHaveLength(2);
  });

  it('creates distinct rows for tokenless creates with identical bodies', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.comments.create({ ...scope, author: alice, body: 'same words' });
    await seed.comments.create({ ...scope, author: alice, body: 'same words' });
    expect((await seed.comments.list(scope)).comments).toHaveLength(2);
  });

  it('soft delete clears body and mentions, keeps ordering and the source key', async () => {
    const seed = await createFactoryStorageForTests();
    const token = 'client-token-0002';
    const created = await seed.comments.create({
      ...scope,
      author: alice,
      body: 'to be removed',
      clientToken: token,
      mentions: [{ kind: 'user', id: bob.id }],
    });

    const deleted = await seed.comments.softDelete({
      orgId: scope.orgId,
      commentId: created.id,
      deletedBy: alice.id,
    });
    expect(deleted).toMatchObject({ body: '', mentions: [], deletedBy: alice.id });
    expect(deleted?.deletedAt).toBeInstanceOf(Date);
    expect(await seed.comments.listMentionsForComment(created.id)).toEqual([]);

    const { comments } = await seed.comments.list(scope);
    expect(comments).toHaveLength(1);
    expect(comments[0]?.deletedAt).toBeInstanceOf(Date);

    const redelivered = await seed.comments.create({
      ...scope,
      author: alice,
      body: 'to be removed',
      clientToken: token,
    });
    expect(redelivered.id).toBe(created.id);
    expect(redelivered.deletedAt).toBeInstanceOf(Date);

    expect(
      await seed.comments.softDelete({ orgId: scope.orgId, commentId: created.id, deletedBy: alice.id }),
    ).toBeNull();
  });

  it('never writes a self-mention row', async () => {
    const seed = await createFactoryStorageForTests();
    const created = await seed.comments.create({
      ...scope,
      author: alice,
      body: 'note to self and Bob',
      mentions: [
        { kind: 'user', id: alice.id },
        { kind: 'user', id: bob.id },
      ],
    });

    const rows = await seed.comments.listMentionsForComment(created.id);
    expect(rows.map(row => row.mentionedId)).toEqual([bob.id]);
    expect(await seed.comments.listMentionsForUser({ ...scope, userId: alice.id, limit: 10 })).toHaveLength(0);
    expect(await seed.comments.listMentionsForUser({ ...scope, userId: bob.id, limit: 10 })).toHaveLength(1);
  });

  it('diffs mention rows on edit: added get rows, removed lose theirs, kept stay', async () => {
    const seed = await createFactoryStorageForTests();
    const created = await seed.comments.create({
      ...scope,
      author: alice,
      body: 'v1',
      mentions: [
        { kind: 'user', id: 'user-bob' },
        { kind: 'user', id: 'user-carol' },
      ],
    });

    const edited = await seed.comments.edit({
      orgId: scope.orgId,
      commentId: created.id,
      body: 'v2',
      mentions: [
        { kind: 'user', id: 'user-carol' },
        { kind: 'user', id: 'user-dave' },
      ],
    });

    expect(edited?.addedMentions).toEqual([{ kind: 'user', id: 'user-dave' }]);
    expect(edited?.removedMentions).toEqual([{ kind: 'user', id: 'user-bob' }]);
    expect(edited?.comment).toMatchObject({ body: 'v2', revision: 2 });
    expect(edited?.comment.editedAt).toBeInstanceOf(Date);

    const rows = await seed.comments.listMentionsForComment(created.id);
    expect(new Set(rows.map(row => row.mentionedId))).toEqual(new Set(['user-carol', 'user-dave']));
  });

  it('refuses to edit a deleted comment', async () => {
    const seed = await createFactoryStorageForTests();
    const created = await seed.comments.create({ ...scope, author: alice, body: 'gone soon' });
    await seed.comments.softDelete({ orgId: scope.orgId, commentId: created.id, deletedBy: alice.id });
    expect(await seed.comments.edit({ orgId: scope.orgId, commentId: created.id, body: 'necromancy' })).toBeNull();
  });

  it('pages the mention inbox newest-first for a user', async () => {
    const seed = await createFactoryStorageForTests();
    for (let i = 0; i < 3; i++) {
      await seed.comments.create({
        ...scope,
        author: alice,
        body: `ping ${i}`,
        occurredAt: new Date(Date.parse('2026-08-01T10:00:00.000Z') + i * 60_000),
        mentions: [{ kind: 'user', id: bob.id }],
      });
    }

    const firstPage = await seed.comments.listMentionsForUser({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      userId: bob.id,
      limit: 2,
    });
    expect(firstPage).toHaveLength(2);
    const last = firstPage[1]!;
    const secondPage = await seed.comments.listMentionsForUser({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      userId: bob.id,
      limit: 2,
      before: { occurredAt: last.occurredAt, id: last.id },
    });
    expect(firstPage[0]!.occurredAt.getTime()).toBeGreaterThan(last.occurredAt.getTime());
    expect(secondPage).toHaveLength(1);
    expect(firstPage.map(row => row.id)).not.toContain(secondPage[0]!.id);
  });

  it('maintains work-item counters by recount and never touches the transition token', async () => {
    const seed = await createFactoryStorageForTests();
    const { item } = await seed.workItems.upsert({
      orgId: scope.orgId,
      userId: alice.id,
      factoryProjectId: scope.factoryProjectId,
      input: { title: 'Fix login', stages: ['intake'], sessions: {}, metadata: {} },
    });
    const itemScope = { ...scope, workItemId: item.id };
    expect(item.commentCount).toBe(0);
    expect(item.feedActivityAt).toBeNull();

    const first = await seed.comments.create({ ...itemScope, author: alice, body: 'one' });
    await seed.comments.refreshWorkItemFeedActivity(itemScope);
    await seed.comments.create({ ...itemScope, author: bob, body: 'two' });
    await seed.comments.refreshWorkItemFeedActivity(itemScope);

    const afterCreates = await seed.workItems.get({ orgId: scope.orgId, id: item.id });
    expect(afterCreates?.commentCount).toBe(2);
    expect(afterCreates?.feedActivityAt).toBeInstanceOf(Date);
    expect(afterCreates?.revision).toBe(item.revision);
    expect(afterCreates?.updatedAt.getTime()).toBe(item.updatedAt.getTime());

    // Replayed bump is idempotent: the recount cannot drift the counter.
    await seed.comments.refreshWorkItemFeedActivity(itemScope);
    expect((await seed.workItems.get({ orgId: scope.orgId, id: item.id }))?.commentCount).toBe(2);

    await seed.comments.softDelete({ orgId: scope.orgId, commentId: first.id, deletedBy: alice.id });
    await seed.comments.refreshWorkItemFeedActivity(itemScope);
    const afterDelete = await seed.workItems.get({ orgId: scope.orgId, id: item.id });
    expect(afterDelete?.commentCount).toBe(1);
    expect(afterDelete?.feedActivityAt!.getTime()).toBeGreaterThanOrEqual(afterCreates!.feedActivityAt!.getTime());
  });

  it('leaves feed activity where it was when a create is replayed', async () => {
    const seed = await createFactoryStorageForTests();
    const { item } = await seed.workItems.upsert({
      orgId: scope.orgId,
      userId: alice.id,
      factoryProjectId: scope.factoryProjectId,
      input: { title: 'Fix login', stages: ['intake'], sessions: {}, metadata: {} },
    });
    const itemScope = { ...scope, workItemId: item.id };
    const token = 'token-replayed';
    await seed.comments.create({ ...itemScope, author: alice, body: 'hello', clientToken: token });
    await seed.comments.refreshWorkItemFeedActivity(itemScope);
    const landed = (await seed.workItems.get({ orgId: scope.orgId, id: item.id }))?.feedActivityAt;

    // A lost response and a retry: the row is recovered, so the feed has not
    // moved and the work item must not jump on a wall clock much later.
    await seed.comments.create({ ...itemScope, author: alice, body: 'hello', clientToken: token });
    await seed.comments.refreshWorkItemFeedActivity({ ...itemScope, now: new Date('2031-01-01T00:00:00.000Z') });

    const afterReplay = await seed.workItems.get({ orgId: scope.orgId, id: item.id });
    expect(afterReplay?.commentCount).toBe(1);
    expect(afterReplay?.feedActivityAt?.getTime()).toBe(landed?.getTime());
  });

  it('keeps a refresh from undoing a newer one, ties included', async () => {
    const at = (iso: string) => ({ feedActivityAt: new Date(iso) });
    const older = { commentCount: 1, ...at('2030-01-01T00:00:00.000Z') };
    const newer = { commentCount: 2, ...at('2030-01-01T00:00:01.000Z') };
    expect(supersedesFeedActivity(newer, older)).toBe(true);
    expect(supersedesFeedActivity(older, newer)).toBe(false);

    // Same stamp, different counts: the snapshot that saw fewer comments read
    // first and must not land its count over the fuller one.
    const thin = { commentCount: 1, ...at('2030-01-01T00:00:00.000Z') };
    const full = { commentCount: 2, ...at('2030-01-01T00:00:00.000Z') };
    expect(supersedesFeedActivity(full, thin)).toBe(true);
    expect(supersedesFeedActivity(thin, full)).toBe(false);
    expect(supersedesFeedActivity(full, full)).toBe(true);
  });

  it('purges comments and mention rows when the work item is hard-deleted', async () => {
    const seed = await createFactoryStorageForTests();
    const { item } = await seed.workItems.upsert({
      orgId: scope.orgId,
      userId: alice.id,
      factoryProjectId: scope.factoryProjectId,
      input: { title: 'Doomed item', stages: ['intake'], sessions: {}, metadata: {} },
    });
    const itemScope = { ...scope, workItemId: item.id };
    await seed.comments.create({
      ...itemScope,
      author: alice,
      body: 'about to be orphaned',
      mentions: [{ kind: 'user', id: bob.id }],
    });

    await seed.workItems.delete({ orgId: scope.orgId, id: item.id });

    expect((await seed.comments.list(itemScope)).comments).toEqual([]);
    expect(await seed.comments.listMentionsForUser({ ...scope, userId: bob.id, limit: 10 })).toHaveLength(0);
  });

  it('dedupes recent authors newest-first for the roster fallback', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.comments.create({ ...scope, author: bob, body: 'older', occurredAt: new Date(Date.now() - 60_000) });
    await seed.comments.create({ ...scope, author: alice, body: 'newer' });
    await seed.comments.create({ ...scope, author: alice, body: 'newest' });

    const authors = await seed.comments.listRecentAuthors({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
    });
    expect(authors.map(author => author.id)).toEqual(['user-alice', 'user-bob']);
  });
});
