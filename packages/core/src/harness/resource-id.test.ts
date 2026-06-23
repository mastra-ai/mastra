import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { Session } from './session';

function createAgent() {
  return new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });
}

async function createSession(opts?: {
  resourceId?: string;
  sessionId?: string;
  ownerId?: string;
  storage?: InMemoryStore;
}) {
  const agent = createAgent();
  const harness = new Harness({
    id: 'test-harness',
    storage: opts?.storage ?? new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
  await harness.init();
  const session = await harness.createSession({
    ...(opts?.sessionId ? { id: opts.sessionId } : {}),
    ...(opts?.ownerId ? { ownerId: opts.ownerId } : {}),
    ...(opts?.resourceId ? { resourceId: opts.resourceId } : {}),
  });
  return { harness, session };
}

describe('Harness resource ID', () => {
  describe('getDefaultResourceId', () => {
    it('returns the harness id when no explicit resourceId is configured', async () => {
      const { session } = await createSession();
      expect(session.identity.getDefaultResourceId()).toBe('test-harness');
    });

    it('returns the configured resourceId when one is provided', async () => {
      const { session } = await createSession({ resourceId: 'custom-resource' });
      expect(session.identity.getDefaultResourceId()).toBe('custom-resource');
    });

    it('still returns the original default after setResourceId is called', async () => {
      const { harness, session } = await createSession({ resourceId: 'original' });
      harness.setResourceId(session, { resourceId: 'changed' });
      expect(session.identity.getResourceId()).toBe('changed');
      expect(session.identity.getDefaultResourceId()).toBe('original');
    });
  });

  describe('stable session identity (id / ownerId)', () => {
    it('defaults id to the effective resourceId when no config is provided', async () => {
      const { session } = await createSession({ resourceId: 'custom-resource' });
      expect(session.identity.getId()).toBe('custom-resource');
    });

    it('defaults id and ownerId to the harness id when no resourceId is configured', async () => {
      const { session } = await createSession();
      expect(session.identity.getId()).toBe('test-harness');
      expect(session.identity.getOwnerId()).toBe('test-harness');
    });

    it('defaults ownerId to the harness id even when a resourceId is configured', async () => {
      const { session } = await createSession({ resourceId: 'custom-resource' });
      expect(session.identity.getOwnerId()).toBe('test-harness');
    });

    it('flows configured sessionId and ownerId into the session identity', async () => {
      const { session } = await createSession({
        resourceId: 'custom-resource',
        sessionId: 'stable-session-id',
        ownerId: 'machine-owner',
      });
      expect(session.identity.getId()).toBe('stable-session-id');
      expect(session.identity.getOwnerId()).toBe('machine-owner');
      // resourceId is independent of id/ownerId
      expect(session.identity.getResourceId()).toBe('custom-resource');
    });

    it('keeps id and ownerId stable when resourceId is switched', async () => {
      const { harness, session } = await createSession({
        resourceId: 'original',
        sessionId: 'stable-session-id',
        ownerId: 'machine-owner',
      });
      harness.setResourceId(session, { resourceId: 'changed' });
      expect(session.identity.getResourceId()).toBe('changed');
      expect(session.identity.getDefaultResourceId()).toBe('original');
      expect(session.identity.getId()).toBe('stable-session-id');
      expect(session.identity.getOwnerId()).toBe('machine-owner');
    });
  });

  describe('getKnownResourceIds', () => {
    let storage: InMemoryStore;
    let harness: Harness;
    let session: Session;

    beforeEach(async () => {
      storage = new InMemoryStore();
      const ctx = await createSession({ storage });
      harness = ctx.harness;
      session = ctx.session;
      // Drop the auto-created starter thread so resource-id assertions only
      // reflect threads explicitly created by each test.
      await session.thread.delete({ threadId: session.thread.getId()! });
    });

    it('returns an empty array when no threads exist', async () => {
      const ids = await harness.getKnownResourceIds(session);
      expect(ids).toEqual([]);
    });

    it('returns unique resource IDs from threads', async () => {
      // Create threads under different resource IDs
      await session.thread.create({ title: 'thread-1' });

      harness.setResourceId(session, { resourceId: 'user-2' });
      await session.thread.create({ title: 'thread-2' });

      harness.setResourceId(session, { resourceId: 'user-3' });
      await session.thread.create({ title: 'thread-3' });

      const ids = await harness.getKnownResourceIds(session);
      expect(ids.sort()).toEqual(['test-harness', 'user-2', 'user-3'].sort());
    });

    it('does not return duplicate resource IDs', async () => {
      await session.thread.create({ title: 'thread-1' });
      await session.thread.create({ title: 'thread-2' });

      const ids = await harness.getKnownResourceIds(session);
      expect(ids).toEqual(['test-harness']);
    });
  });
});
