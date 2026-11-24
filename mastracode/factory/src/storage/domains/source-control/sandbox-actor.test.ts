import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished } from 'vitest';

import { sessionSandboxUser } from '../../../sandbox/vault.js';
import { FactoryProjectsStorage } from '../projects/base.js';
import { SourceControlStorage } from './base.js';
import { SourceControlStorageInMemory } from './inmemory.js';

describe.each(['libsql', 'inmemory'] as const)('sandbox credential attribution (%s)', adapter => {
  async function setup() {
    const backend = new LibSQLFactoryStorage({ id: 'sandbox-actor-test', url: ':memory:' });
    const projects = backend.registerDomain(new FactoryProjectsStorage());
    const domain = backend.registerDomain(new SourceControlStorage());
    await backend.init();
    onTestFinished(() => backend.close());
    const project = await projects.create({ orgId: 'org-1', userId: 'owner-1', input: { name: 'Actor test' } });
    const store = adapter === 'libsql' ? domain.forIntegration('github') : new SourceControlStorageInMemory();
    const installation = await store.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'owner-1',
      externalId: 'installation-1',
    });
    const repository = await store.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: 'repo-1', slug: 'mastra-ai/mastra', defaultBranch: 'main' },
    });
    const connection = await store.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: 'owner-1',
    });
    const link = await store.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
    });
    const session = await store.sessions.create({
      orgId: 'org-1',
      sessionId: 'session-1',
      projectRepositoryId: link.id,
      userId: 'owner-1',
      branch: 'factory/work',
      baseBranch: 'main',
    });
    return { store, session };
  }

  it('lets an explicit human approval claim an unattributed session before any VM exists', async () => {
    const { store, session } = await setup();
    await store.sessions.setSandboxUser({ sessionId: session.sessionId, userId: null });
    await store.sessions.setSandboxUser({ sessionId: session.sessionId, userId: 'approver-1' });
    expect((await store.sessions.getBySessionId(session.sessionId))?.sandboxUserId).toBe('approver-1');
  });

  it.each(['sandbox', 'materialized'] as const)('never reattributes automation after %s', async state => {
    const { store, session } = await setup();
    await store.sessions.setSandboxUser({ sessionId: session.sessionId, userId: null });
    if (state === 'sandbox') {
      await store.sessions.setSandbox({ id: session.id, sandboxId: 'automation-vm', sandboxWorkdir: '/workspace' });
    } else {
      await store.sessions.markMaterialized({ id: session.id });
    }
    await expect(store.sessions.setSandboxUser({ sessionId: session.sessionId, userId: 'approver-1' })).rejects.toThrow(
      'cannot change',
    );
    expect((await store.sessions.getBySessionId(session.sessionId))?.sandboxUserId).toBeNull();
  });

  it('keeps an authenticated human actor immutable', async () => {
    const userId = 'starter-1';
    const { store, session } = await setup();
    await store.sessions.setSandboxUser({ sessionId: session.sessionId, userId });
    await store.sessions.setSandboxUser({ sessionId: session.sessionId, userId });
    await expect(store.sessions.setSandboxUser({ sessionId: session.sessionId, userId: 'other-1' })).rejects.toThrow(
      'cannot change',
    );
    const reloaded = await store.sessions.getBySessionId(session.sessionId);
    expect(reloaded?.userId).toBe('owner-1');
    expect(reloaded?.sandboxUserId).toBe(userId);
    expect(sessionSandboxUser(reloaded!)).toBe(userId ?? undefined);
  });

  it('does not attach a new actor to an already-created legacy sandbox', async () => {
    const { store, session } = await setup();
    await store.sessions.setSandbox({ id: session.id, sandboxId: 'old-vm', sandboxWorkdir: '/workspace' });
    await expect(store.sessions.setSandboxUser({ sessionId: session.sessionId, userId: 'starter-1' })).rejects.toThrow(
      'cannot change',
    );
    expect((await store.sessions.getBySessionId(session.sessionId))?.sandboxUserId).toBeUndefined();
  });

  it('does not reinterpret a synthetic Factory owner as a human on legacy rows', async () => {
    const { store, session } = await setup();
    expect(sessionSandboxUser(session)).toBe('owner-1');
    const transferred = await store.sessions.transferOwner({
      sessionId: session.sessionId,
      expectedUserId: 'owner-1',
      toUserId: 'factory-project:project-1',
    });
    expect(transferred.status).toBe('updated');
    const reloaded = await store.sessions.getBySessionId(session.sessionId);
    expect(sessionSandboxUser(reloaded!)).toBeUndefined();
  });

  it.each(Array.from({ length: 20 }, (_, attempt) => attempt))(
    'allows only one competing starter to claim the credential actor (attempt %i)',
    async () => {
      const { store, session } = await setup();
      const results = await Promise.allSettled(
        ['starter-1', 'starter-2'].map(userId =>
          store.sessions.setSandboxUser({ sessionId: session.sessionId, userId }),
        ),
      );
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
      const reloaded = await store.sessions.getBySessionId(session.sessionId);
      expect(['starter-1', 'starter-2']).toContain(reloaded?.sandboxUserId);
    },
  );
});
