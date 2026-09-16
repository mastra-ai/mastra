/**
 * Comments domain over HTTP: tenancy guards, authorization, caps, reply
 * snapshots, idempotent create, counters on the wire, and the mention roster.
 */

import { EventEmitterPubSub } from '@mastra/core/events';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth, mountApiRoutes } from '../../../routes/test-utils.js';
import type { TestAuthUser } from '../../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../test-utils.js';
import type { AuditEmitter } from '../audit/domain.js';
import type { CommentsDomainOptions } from './domain.js';
import { CommentsDomain } from './domain.js';

type Seed = Awaited<ReturnType<typeof createFactoryStorageForTests>>;

const ORG = 'org-1';

function commentsDomain(seed: Seed, options?: Partial<CommentsDomainOptions>) {
  return new CommentsDomain({
    auth: fakeRouteAuth(),
    comments: seed.comments,
    workItems: seed.workItems,
    projects: seed.projects,
    channelIdentity: seed.channelIdentity,
    pubsub: new EventEmitterPubSub(),
    ...options,
  });
}

function buildApp(domain: CommentsDomain, user?: TestAuthUser & { name?: string }) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app as never, domain.routes());
  return app;
}

async function seedWorkItem(seed: Seed, { orgId = ORG, factoryProjectId = 'project-1', title = 'Fix login' } = {}) {
  const { item } = await seed.workItems.upsert({
    orgId,
    userId: 'user-alice',
    factoryProjectId,
    input: { title, stages: ['intake'], sessions: {}, metadata: {} },
  });
  return item;
}

const asAlice = { workosId: 'user-alice', organizationId: ORG, name: 'Alice' };
const asBob = { workosId: 'user-bob', organizationId: ORG, name: 'Bob' };

async function postComment(
  app: Hono,
  workItemId: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: any }> {
  const response = await app.request(`/web/factory/work-items/${workItemId}/comments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => undefined) };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CommentsDomain routes', () => {
  it('guards the feed by auth, organization, and work-item ownership', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed, { orgId: 'other-org' });
    const domain = commentsDomain(seed);
    const path = `/web/factory/work-items/${item.id}/comments`;

    expect((await buildApp(domain).request(path)).status).toBe(401);
    expect((await buildApp(domain, { workosId: 'user-alice' }).request(path)).status).toBe(403);
    expect((await buildApp(domain, asAlice).request('/web/factory/work-items/not-a-uuid/comments')).status).toBe(404);
    expect((await buildApp(domain, asAlice).request(path)).status).toBe(404);
  });

  it('creates a comment with the auth actor snapshot and surfaces the counters on the work item', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const app = buildApp(commentsDomain(seed), asAlice);

    const { status, json } = await postComment(app, item.id, {
      body: 'First!',
      mentions: [{ kind: 'user', id: 'user-bob' }],
    });
    expect(status).toBe(201);
    expect(json.comment).toMatchObject({
      workItemId: item.id,
      body: 'First!',
      author: { kind: 'user', id: 'user-alice', displayName: 'Alice' },
      mentions: [{ kind: 'user', id: 'user-bob' }],
    });

    const updated = await seed.workItems.get({ orgId: ORG, id: item.id });
    expect(updated?.commentCount).toBe(1);
    expect(updated?.feedActivityAt).toBeInstanceOf(Date);
    expect(updated?.revision).toBe(item.revision);
  });

  it('replays a clientToken create as the same comment', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const app = buildApp(commentsDomain(seed), asAlice);
    const payload = { body: 'posted once', clientToken: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' };

    const first = await postComment(app, item.id, payload);
    const replay = await postComment(app, item.id, payload);
    expect(replay.json.comment.id).toBe(first.json.comment.id);
    expect((await seed.workItems.get({ orgId: ORG, id: item.id }))?.commentCount).toBe(1);
  });

  it('409s a clientToken replay that targets another work item or another author', async () => {
    const seed = await createFactoryStorageForTests();
    const itemA = await seedWorkItem(seed, { title: 'Item A' });
    const itemB = await seedWorkItem(seed, { title: 'Item B' });
    const domain = commentsDomain(seed);
    const payload = { body: 'posted once', clientToken: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' };

    expect((await postComment(buildApp(domain, asAlice), itemA.id, payload)).status).toBe(201);

    const crossItem = await postComment(buildApp(domain, asAlice), itemB.id, payload);
    expect(crossItem.status).toBe(409);
    expect(crossItem.json).toEqual({ error: 'comment_token_conflict' });

    const crossAuthor = await postComment(buildApp(domain, asBob), itemA.id, payload);
    expect(crossAuthor.status).toBe(409);
    expect(crossAuthor.json).toEqual({ error: 'comment_token_conflict' });
  });

  it('rejects oversized bodies, oversized mention lists, and unmentionable ids', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const app = buildApp(commentsDomain(seed), asAlice);

    expect((await postComment(app, item.id, { body: '' })).status).toBe(422);
    expect((await postComment(app, item.id, { body: '   ' })).status).toBe(422);
    expect((await postComment(app, item.id, { body: 'x'.repeat(16_001) })).status).toBe(422);
    expect(
      (
        await postComment(app, item.id, {
          body: 'crowd',
          mentions: Array.from({ length: 21 }, (_, i) => ({ kind: 'user', id: `user-${i}` })),
        })
      ).status,
    ).toBe(422);
    expect(
      (await postComment(app, item.id, { body: 'hi', mentions: [{ kind: 'user', id: 'slack:U123' }] })).status,
    ).toBe(422);
  });

  it('snapshots the reply quote so it survives parent edit and delete', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const domain = commentsDomain(seed);
    const aliceApp = buildApp(domain, asAlice);
    const bobApp = buildApp(domain, asBob);

    const parent = (await postComment(bobApp, item.id, { body: 'the original claim' })).json.comment;
    const reply = (
      await postComment(aliceApp, item.id, {
        body: 'quoting you',
        replyTo: { commentId: parent.id, quote: 'the original claim' },
      })
    ).json.comment;
    expect(reply.replyTo).toMatchObject({
      commentId: parent.id,
      quote: 'the original claim',
      authorId: 'user-bob',
      authorName: 'Bob',
    });

    await bobApp.request(`/web/factory/work-items/${item.id}/comments/${parent.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'revised claim' }),
    });
    await bobApp.request(`/web/factory/work-items/${item.id}/comments/${parent.id}`, { method: 'DELETE' });

    const kept = await seed.comments.get({ orgId: ORG, commentId: reply.id });
    expect(kept?.replyTo?.quote).toBe('the original claim');
    expect(kept?.replyTo?.authorName).toBe('Bob');
  });

  it('rejects a reply targeting a comment on another work item', async () => {
    const seed = await createFactoryStorageForTests();
    const itemA = await seedWorkItem(seed, { title: 'Item A' });
    const itemB = await seedWorkItem(seed, { title: 'Item B' });
    const app = buildApp(commentsDomain(seed), asAlice);

    const foreign = (await postComment(app, itemA.id, { body: 'on A' })).json.comment;
    const { status } = await postComment(app, itemB.id, { body: 'on B', replyTo: { commentId: foreign.id } });
    expect(status).toBe(422);
  });

  it('lets only the author or an org admin edit, and admins delete', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const memberDomain = commentsDomain(seed, {
      auth: fakeRouteAuth({ isOrganizationAdmin: async (_org, userId) => userId === 'user-admin' }),
    });

    const comment = (await postComment(buildApp(memberDomain, asAlice), item.id, { body: 'mine' })).json.comment;
    const path = `/web/factory/work-items/${item.id}/comments/${comment.id}`;
    const patch = (app: Hono, body: string) =>
      app.request(path, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });

    expect((await patch(buildApp(memberDomain, asBob), 'hijacked')).status).toBe(403);
    expect((await patch(buildApp(memberDomain, asAlice), 'still mine')).status).toBe(200);
    const adminEdit = await patch(
      buildApp(memberDomain, { workosId: 'user-admin', organizationId: ORG, name: 'Admin' }),
      'moderated',
    );
    expect(adminEdit.status).toBe(200);

    expect((await buildApp(memberDomain, asBob).request(path, { method: 'DELETE' })).status).toBe(403);
    const adminDelete = await buildApp(memberDomain, {
      workosId: 'user-admin',
      organizationId: ORG,
    }).request(path, { method: 'DELETE' });
    expect(adminDelete.status).toBe(200);
    expect((await buildApp(memberDomain, asAlice).request(path, { method: 'DELETE' })).status).toBe(409);
  });

  it('409s an edit whose expectedRevision is stale, and lands it when current', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const app = buildApp(commentsDomain(seed), asAlice);

    const comment = (await postComment(app, item.id, { body: 'v1' })).json.comment;
    expect(comment.revision).toBe(1);
    const path = `/web/factory/work-items/${item.id}/comments/${comment.id}`;
    const patch = (body: Record<string, unknown>) =>
      app.request(path, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    const first = await patch({ body: 'v2', expectedRevision: 1 });
    expect(first.status).toBe(200);
    expect((await first.json()).comment.revision).toBe(2);

    const stale = await patch({ body: 'v2-lost-race', expectedRevision: 1 });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: 'comment_conflict' });

    const list = await (await app.request(`/web/factory/work-items/${item.id}/comments`)).json();
    expect(list.comments[0].body).toBe('v2');
  });

  it('diffs mention rows on edit and lists the tombstone after delete', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const app = buildApp(commentsDomain(seed), asAlice);

    const comment = (await postComment(app, item.id, { body: 'ping', mentions: [{ kind: 'user', id: 'user-bob' }] }))
      .json.comment;
    await app.request(`/web/factory/work-items/${item.id}/comments/${comment.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'ping Carol instead', mentions: [{ kind: 'user', id: 'user-carol' }] }),
    });
    const scope = { orgId: ORG, factoryProjectId: 'project-1' };
    expect(await seed.comments.listMentionsForUser({ ...scope, userId: 'user-bob', limit: 10 })).toHaveLength(0);
    expect(await seed.comments.listMentionsForUser({ ...scope, userId: 'user-carol', limit: 10 })).toHaveLength(1);

    await app.request(`/web/factory/work-items/${item.id}/comments/${comment.id}`, { method: 'DELETE' });
    const list = await (await app.request(`/web/factory/work-items/${item.id}/comments`)).json();
    expect(list.comments).toHaveLength(1);
    expect(list.comments[0]).toMatchObject({ body: '' });
    expect(list.comments[0].deletedAt).toBeTruthy();
    expect((await seed.workItems.get({ orgId: ORG, id: item.id }))?.commentCount).toBe(0);
  });

  it('emits audit events for create, mention, edit, and delete', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const emit = vi.fn<AuditEmitter['emit']>(async () => {});
    const app = buildApp(commentsDomain(seed, { audit: { emit } }), asAlice);

    const comment = (await postComment(app, item.id, { body: 'hello', mentions: [{ kind: 'user', id: 'user-bob' }] }))
      .json.comment;
    await app.request(`/web/factory/work-items/${item.id}/comments/${comment.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'hello v2' }),
    });
    await app.request(`/web/factory/work-items/${item.id}/comments/${comment.id}`, { method: 'DELETE' });

    const actions = emit.mock.calls.map(([call]) => call.input.action);
    expect(actions).toEqual([
      'factory.work_item.comment_created',
      'factory.work_item.comment_mentioned',
      'factory.work_item.comment_edited',
      'factory.work_item.comment_deleted',
    ]);
  });

  it('serves the roster from the members hook when wired', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: ORG, userId: 'user-alice', input: { name: 'Acme' } });
    const listOrganizationMembers = vi.fn(async () => [
      { id: 'user-alice', name: 'Alice' },
      { id: 'user-bob', name: 'Bob' },
      { id: 'slack:U99', name: 'Unlinked' },
    ]);
    const app = buildApp(commentsDomain(seed, { members: { listOrganizationMembers } }), asAlice);

    const response = await app.request(`/web/factory/projects/${project.id}/mention-roster`);
    expect(response.status).toBe(200);
    expect((await response.json()).members).toEqual([
      { id: 'user-alice', name: 'Alice' },
      { id: 'user-bob', name: 'Bob' },
    ]);

    await app.request(`/web/factory/projects/${project.id}/mention-roster`);
    expect(listOrganizationMembers).toHaveBeenCalledTimes(1);
  });

  it('falls back to recent comment authors and channel links, with prefix filtering', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: ORG, userId: 'user-alice', input: { name: 'Acme' } });
    await seed.comments.create({
      orgId: ORG,
      factoryProjectId: project.id,
      workItemId: 'item-1',
      author: { kind: 'user', id: 'user-alice', displayName: 'Alice' },
      body: 'seen recently',
    });
    await seed.comments.create({
      orgId: ORG,
      factoryProjectId: project.id,
      workItemId: 'item-1',
      author: {
        kind: 'user',
        id: 'slack:U42',
        displayName: 'External Sam',
        external: { platform: 'slack', userId: 'U42' },
      },
      body: 'external voice',
    });
    await seed.channelIdentity.saveAccountLink({
      platform: 'slack',
      externalTeamId: 'T1',
      externalUserId: 'U7',
      orgId: ORG,
      userId: 'user-carol',
      externalUserName: 'Carol',
    });
    const app = buildApp(commentsDomain(seed), asAlice);

    const all = await (await app.request(`/web/factory/projects/${project.id}/mention-roster`)).json();
    expect(all.members).toEqual([
      { id: 'user-alice', name: 'Alice' },
      { id: 'user-carol', name: 'Carol' },
    ]);

    const filtered = await (await app.request(`/web/factory/projects/${project.id}/mention-roster?q=ca`)).json();
    expect(filtered.members).toEqual([{ id: 'user-carol', name: 'Carol' }]);
  });

  it('404s the roster for a project outside the caller organization', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: 'other-org', userId: 'user-x', input: { name: 'Foreign' } });
    const app = buildApp(commentsDomain(seed), asAlice);
    expect((await app.request(`/web/factory/projects/${project.id}/mention-roster`)).status).toBe(404);
  });
});

describe('feed publishers', () => {
  const alice = { kind: 'user' as const, id: 'user-alice', displayName: 'Alice' };

  function slackPublisher(publish = vi.fn()) {
    publish.mockImplementation(async (comment: { id: string }) => ({
      source: { integrationId: 'slack', type: 'message', externalId: `C1:${comment.id}` },
    }));
    return { publisher: { id: 'slack', publish }, publish };
  }

  it('mirrors a created comment and writes the platform source back onto the row', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const { publisher, publish } = slackPublisher();
    const domain = commentsDomain(seed, { publishers: [publisher] });

    const result = await domain.createComment({ orgId: ORG, workItemId: item.id, author: alice, body: 'ship it' });
    expect(result.status).toBe('created');
    if (result.status !== 'created') return;

    await result.mirrored;
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ id: result.comment.id, body: 'ship it' }),
      expect.objectContaining({ id: item.id }),
    );
    const stored = await seed.comments.get({ orgId: ORG, commentId: result.comment.id });
    expect(stored?.externalSource).toEqual({
      integrationId: 'slack',
      type: 'message',
      externalId: `C1:${result.comment.id}`,
    });
  });

  it('keeps a local retry idempotent after the write-back, without re-publishing', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const { publisher, publish } = slackPublisher();
    const domain = commentsDomain(seed, { publishers: [publisher] });
    const input = { orgId: ORG, workItemId: item.id, author: alice, body: 'once', clientToken: 'token-1' };

    const first = await domain.createComment(input);
    if (first.status === 'created') await first.mirrored;
    const replay = await domain.createComment(input);

    expect(first.status).toBe('created');
    expect(replay.status).toBe('created');
    if (first.status !== 'created' || replay.status !== 'created') return;
    await replay.mirrored;
    expect(replay.comment.id).toBe(first.comment.id);
    expect(publish).toHaveBeenCalledTimes(1);
    const page = await seed.comments.list({ orgId: ORG, factoryProjectId: item.factoryProjectId, workItemId: item.id });
    expect(page.comments).toHaveLength(1);
  });

  it('leaves the row alone when a publisher declines the item as none of its own', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const publish = vi.fn().mockResolvedValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const domain = commentsDomain(seed, { publishers: [{ id: 'slack', publish }] });

    const result = await domain.createComment({ orgId: ORG, workItemId: item.id, author: alice, body: 'no thread' });

    expect(result.status).toBe('created');
    if (result.status !== 'created') return;
    await result.mirrored;
    expect(publish).toHaveBeenCalledTimes(1);
    // Declining is an answer, not a failure — nothing to warn about.
    expect(warn).not.toHaveBeenCalled();
    expect((await seed.comments.get({ orgId: ORG, commentId: result.comment.id }))?.externalSource).toBeNull();
  });

  it('never mirrors an ingested platform message back to the platform it came from', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const { publisher, publish } = slackPublisher();
    const domain = commentsDomain(seed, { publishers: [publisher] });
    const externalSource = { integrationId: 'slack', type: 'message', externalId: 'C1:1700.99' };
    const occurredAt = new Date('2026-08-30T10:00:00.000Z');

    const result = await domain.createComment({
      orgId: ORG,
      workItemId: item.id,
      author: { kind: 'user', id: 'slack:U-1', displayName: 'Caleb' },
      body: 'said it in slack',
      externalSource,
      occurredAt,
    });

    expect(result.status).toBe('created');
    if (result.status !== 'created') return;
    await result.mirrored;
    expect(publish).not.toHaveBeenCalled();
    const stored = await seed.comments.get({ orgId: ORG, commentId: result.comment.id });
    expect(stored?.externalSource).toEqual(externalSource);
    // The platform's own clock, so the feed and the Slack thread order alike.
    expect(stored?.occurredAt).toEqual(occurredAt);
  });

  it('keeps a redelivered platform message to a single comment', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const domain = commentsDomain(seed);
    const input = {
      orgId: ORG,
      workItemId: item.id,
      author: { kind: 'user' as const, id: 'slack:U-1' },
      body: 'said once',
      externalSource: { integrationId: 'slack', type: 'message', externalId: 'C1:1700.99' },
    };

    const first = await domain.createComment(input);
    const replay = await domain.createComment(input);

    expect(first.status).toBe('created');
    expect(replay.status).toBe('created');
    if (first.status !== 'created' || replay.status !== 'created') return;
    expect(replay.comment.id).toBe(first.comment.id);
    const page = await seed.comments.list({ orgId: ORG, factoryProjectId: item.factoryProjectId, workItemId: item.id });
    expect(page.comments).toHaveLength(1);
  });

  it('returns the comment while a publisher is still hanging on the platform', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const domain = commentsDomain(seed, { publishers: [{ id: 'slack', publish: () => new Promise(() => {}) }] });

    const result = await domain.createComment({ orgId: ORG, workItemId: item.id, author: alice, body: 'still lands' });

    expect(result.status).toBe('created');
  });

  it('never fails the create when a publisher throws', async () => {
    const seed = await createFactoryStorageForTests();
    const item = await seedWorkItem(seed);
    const publish = vi.fn(async () => {
      throw new Error('slack is down');
    });
    const domain = commentsDomain(seed, { publishers: [{ id: 'slack', publish }] });

    const result = await domain.createComment({ orgId: ORG, workItemId: item.id, author: alice, body: 'still lands' });

    expect(result.status).toBe('created');
    if (result.status !== 'created') return;
    await result.mirrored;
    expect((await seed.comments.get({ orgId: ORG, commentId: result.comment.id }))?.externalSource).toBeNull();
  });
});
