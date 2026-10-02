import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import type { Session } from './session';
import { createMockWorkspace } from './test-utils';

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
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage: opts?.storage ?? new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
  await controller.init();
  const session = await controller.createSession({
    id: opts?.sessionId ?? 'test-session-id',
    ownerId: opts?.ownerId ?? 'test-owner',
    ...(opts?.resourceId ? { resourceId: opts.resourceId } : {}),
  });
  return { controller, session };
}

describe('AgentController resource ID', () => {
  describe('getDefaultResourceId', () => {
    it('returns the controller id when no explicit resourceId is configured', async () => {
      const { session } = await createSession();
      expect(session.identity.getDefaultResourceId()).toBe('test-controller');
    });

    it('returns the configured resourceId when one is provided', async () => {
      const { session } = await createSession({ resourceId: 'custom-resource' });
      expect(session.identity.getDefaultResourceId()).toBe('custom-resource');
    });

    it('still returns the original default after setResourceId is called', async () => {
      const { controller, session } = await createSession({ resourceId: 'original' });
      await controller.setResourceId(session, { resourceId: 'changed' });
      expect(session.identity.getResourceId()).toBe('changed');
      expect(session.identity.getDefaultResourceId()).toBe('original');
    });
  });

  describe('stable session identity (id / ownerId)', () => {
    it('uses the explicitly provided id and ownerId', async () => {
      const { session } = await createSession({
        resourceId: 'custom-resource',
        sessionId: 'explicit-id',
        ownerId: 'explicit-owner',
      });
      expect(session.identity.getId()).toBe('explicit-id');
      expect(session.identity.getOwnerId()).toBe('explicit-owner');
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
      const { controller, session } = await createSession({
        resourceId: 'original',
        sessionId: 'stable-session-id',
        ownerId: 'machine-owner',
      });
      await controller.setResourceId(session, { resourceId: 'changed' });
      expect(session.identity.getResourceId()).toBe('changed');
      expect(session.identity.getDefaultResourceId()).toBe('original');
      expect(session.identity.getId()).toBe('stable-session-id');
      expect(session.identity.getOwnerId()).toBe('machine-owner');
    });
  });

  describe('getKnownResourceIds', () => {
    let storage: InMemoryStore;
    let controller: AgentController;
    let session: Session;

    beforeEach(async () => {
      storage = new InMemoryStore();
      const ctx = await createSession({ storage });
      controller = ctx.controller;
      session = ctx.session;
      // Drop the auto-created starter thread so resource-id assertions only
      // reflect threads explicitly created by each test.
      await session.thread.delete({ threadId: session.thread.getId()! });
    });

    it('returns an empty array when no threads exist', async () => {
      const ids = await controller.getKnownResourceIds(session);
      expect(ids).toEqual([]);
    });

    it('returns unique resource IDs from threads', async () => {
      // Create threads under different resource IDs
      await session.thread.create({ title: 'thread-1' });

      await controller.setResourceId(session, { resourceId: 'user-2' });
      await session.thread.create({ title: 'thread-2' });

      await controller.setResourceId(session, { resourceId: 'user-3' });
      await session.thread.create({ title: 'thread-3' });

      const ids = await controller.getKnownResourceIds(session);
      expect(ids.sort()).toEqual(['test-controller', 'user-2', 'user-3'].sort());
    });

    it('does not return duplicate resource IDs', async () => {
      await session.thread.create({ title: 'thread-1' });
      await session.thread.create({ title: 'thread-2' });

      const ids = await controller.getKnownResourceIds(session);
      expect(ids).toEqual(['test-controller']);
    });
  });
});
