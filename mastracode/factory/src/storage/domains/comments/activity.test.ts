/**
 * Activity fan-out over a real backend: who gets a row, when a row bumps, and
 * what never mints one.
 */

import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';
import type { FactoryStorageTestSeed } from '../../test-utils.js';
import { factoryActivityAttentionIdentity } from '../work-items/base.js';
import type { FactoryActorRef } from './actor.js';

const ORG = 'org-1';
const alice: FactoryActorRef = { kind: 'user', id: 'user-alice', displayName: 'Alice' };
const bob: FactoryActorRef = { kind: 'user', id: 'user-bob', displayName: 'Bob' };
const carol: FactoryActorRef = { kind: 'user', id: 'user-carol', displayName: 'Carol' };

async function seedItem(seed: FactoryStorageTestSeed, { createdBy = 'user-owner' } = {}) {
  const project = await seed.projects.create({ orgId: ORG, userId: createdBy, input: { name: 'Acme' } });
  const { item } = await seed.workItems.upsert({
    orgId: ORG,
    userId: createdBy,
    factoryProjectId: project.id,
    input: { title: 'Fix login', stages: ['intake'], sessions: {}, metadata: {} },
  });
  return { projectId: project.id, item };
}

function activityFor(seed: FactoryStorageTestSeed, projectId: string, userId: string) {
  return seed.comments.listActivityForUser({
    orgId: ORG,
    factoryProjectId: projectId,
    userId,
    limit: 50,
  });
}

describe('work item activity fan-out', () => {
  it('opens a row for the item creator carrying the latest comment snapshot', async () => {
    const seed = await createFactoryStorageForTests();
    const { projectId, item } = await seedItem(seed, { createdBy: 'user-owner' });

    const comment = await seed.comments.create({
      orgId: ORG,
      factoryProjectId: projectId,
      workItemId: item.id,
      author: alice,
      body: 'looking at it now',
    });

    expect(await activityFor(seed, projectId, 'user-owner')).toEqual([
      expect.objectContaining({
        workItemId: item.id,
        participantId: 'user-owner',
        occurrence: 1,
        latestCommentId: comment.id,
        latestAuthorId: alice.id,
        latestAuthorName: 'Alice',
      }),
    ]);
  });

  it('never gives an author a row for their own comment', async () => {
    const seed = await createFactoryStorageForTests();
    const { projectId, item } = await seedItem(seed, { createdBy: alice.id });

    await seed.comments.create({
      orgId: ORG,
      factoryProjectId: projectId,
      workItemId: item.id,
      author: alice,
      body: 'note to self',
    });

    expect(await activityFor(seed, projectId, alice.id)).toEqual([]);
  });

  it('bumps the first author to occurrence 2 when a second author joins', async () => {
    const seed = await createFactoryStorageForTests();
    const { projectId, item } = await seedItem(seed, { createdBy: 'user-owner' });
    const post = (author: FactoryActorRef, body: string) =>
      seed.comments.create({ orgId: ORG, factoryProjectId: projectId, workItemId: item.id, author, body });

    await post(alice, 'first');
    await post(bob, 'second');
    const third = await post(carol, 'third');

    const [aliceRow] = await activityFor(seed, projectId, alice.id);
    const [bobRow] = await activityFor(seed, projectId, bob.id);
    expect(aliceRow).toMatchObject({ occurrence: 2, latestCommentId: third.id, latestAuthorId: carol.id });
    expect(bobRow).toMatchObject({ occurrence: 1, latestCommentId: third.id });
    // The owner heard about all three.
    expect((await activityFor(seed, projectId, 'user-owner'))[0]).toMatchObject({ occurrence: 3 });
  });

  it('subtracts the mentioned users, so one comment is never two unread rows', async () => {
    const seed = await createFactoryStorageForTests();
    const { projectId, item } = await seedItem(seed, { createdBy: 'user-owner' });

    await seed.comments.create({
      orgId: ORG,
      factoryProjectId: projectId,
      workItemId: item.id,
      author: alice,
      body: 'over to you @owner',
      mentions: [{ kind: 'user', id: 'user-owner' }],
    });

    expect(await activityFor(seed, projectId, 'user-owner')).toEqual([]);
  });

  it('bumps nothing on a replayed create', async () => {
    const seed = await createFactoryStorageForTests();
    const { projectId, item } = await seedItem(seed, { createdBy: 'user-owner' });
    const input = {
      orgId: ORG,
      factoryProjectId: projectId,
      workItemId: item.id,
      author: alice,
      body: 'said once',
      clientToken: 'token-1',
    };

    await seed.comments.create(input);
    await seed.comments.create(input);

    expect((await activityFor(seed, projectId, 'user-owner'))[0]).toMatchObject({ occurrence: 1 });
  });

  it('lets agents bump humans without ever receiving a row itself', async () => {
    const seed = await createFactoryStorageForTests();
    const { projectId, item } = await seedItem(seed, { createdBy: 'user-owner' });
    const agent: FactoryActorRef = { kind: 'agent', id: 'agent:binding-1', displayName: 'Agent' };

    await seed.comments.create({
      orgId: ORG,
      factoryProjectId: projectId,
      workItemId: item.id,
      author: agent,
      body: 'pushed a fix',
    });
    await seed.comments.create({
      orgId: ORG,
      factoryProjectId: projectId,
      workItemId: item.id,
      author: alice,
      body: 'thanks',
    });

    expect((await activityFor(seed, projectId, 'user-owner'))[0]).toMatchObject({ occurrence: 2 });
    expect(await activityFor(seed, projectId, 'agent:binding-1')).toEqual([]);
  });

  it('mints nothing for the rule dispatcher that materialized the item', async () => {
    const seed = await createFactoryStorageForTests();
    const { projectId, item } = await seedItem(seed, { createdBy: 'factory-rule-dispatcher' });

    await seed.comments.create({
      orgId: ORG,
      factoryProjectId: projectId,
      workItemId: item.id,
      author: alice,
      body: 'picking this up',
    });

    expect(await activityFor(seed, projectId, 'factory-rule-dispatcher')).toEqual([]);
  });

  it('bumps on a backdated comment but holds the pointer forward', async () => {
    const seed = await createFactoryStorageForTests();
    const { projectId, item } = await seedItem(seed, { createdBy: 'user-owner' });
    const post = (body: string, occurredAt: Date) =>
      seed.comments.create({
        orgId: ORG,
        factoryProjectId: projectId,
        workItemId: item.id,
        author: alice,
        body,
        occurredAt,
      });

    const recent = await post('the newest', new Date('2026-08-26T12:00:00.000Z'));
    await post('a late arrival from yesterday', new Date('2026-08-25T09:00:00.000Z'));

    expect((await activityFor(seed, projectId, 'user-owner'))[0]).toMatchObject({
      occurrence: 2,
      latestCommentId: recent.id,
      occurredAt: new Date('2026-08-26T12:00:00.000Z'),
    });
  });

  it('takes its rows and receipts down with the work item', async () => {
    const seed = await createFactoryStorageForTests();
    const { projectId, item } = await seedItem(seed, { createdBy: 'user-owner' });
    await seed.comments.create({
      orgId: ORG,
      factoryProjectId: projectId,
      workItemId: item.id,
      author: alice,
      body: 'in progress',
    });
    const receipt = await seed.workItems.setAttentionReceipt({
      orgId: ORG,
      factoryProjectId: projectId,
      userId: 'user-owner',
      identity: factoryActivityAttentionIdentity(item.id, 1),
      action: 'read',
      now: new Date(),
    });
    expect(receipt).not.toBeNull();

    await seed.workItems.delete({ orgId: ORG, id: item.id });

    expect(await activityFor(seed, projectId, 'user-owner')).toEqual([]);
    expect(
      await seed.workItems.listAttentionReceipts({
        orgId: ORG,
        factoryProjectId: projectId,
        userId: 'user-owner',
        identities: [factoryActivityAttentionIdentity(item.id, 1)],
      }),
    ).toEqual([]);
  });

  it('keeps the row when the latest comment is soft-deleted', async () => {
    const seed = await createFactoryStorageForTests();
    const { projectId, item } = await seedItem(seed, { createdBy: 'user-owner' });
    const comment = await seed.comments.create({
      orgId: ORG,
      factoryProjectId: projectId,
      workItemId: item.id,
      author: alice,
      body: 'oops',
    });

    await seed.comments.softDelete({ orgId: ORG, commentId: comment.id, deletedBy: alice.id });

    expect((await activityFor(seed, projectId, 'user-owner'))[0]).toMatchObject({
      occurrence: 1,
      latestCommentId: comment.id,
    });
  });
});
