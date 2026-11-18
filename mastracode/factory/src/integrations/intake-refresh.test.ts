import { describe, expect, it } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { IntegrationContext } from './base.js';
import { addReconcileSummary, emptyIntakeRefreshSummary, scopeIntegrationContextToProject } from './intake-refresh.js';

async function seeded() {
  const storage = await createFactoryStorageForTests();
  const refreshed = await storage.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Refreshed' } });
  const other = await storage.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Other' } });
  const card = await storage.workItems.upsert({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: refreshed.id,
    input: { title: 'Filed by an event', stages: ['intake'], sessions: {} },
  });
  const ctx = {
    storage: { projects: storage.projects, intake: storage.intake },
    runtime: {
      configVersion: 'test-v1',
      workItems: storage.workItems,
      boards: createBoardRegistry(),
      // Kept cards that missed the event: a refresh must not trust them.
      keptCards: { projects: async () => [refreshed, other], cards: async () => [] },
    },
  } as unknown as IntegrationContext;
  return { storage, refreshed, other, card, ctx };
}

describe('scopeIntegrationContextToProject', () => {
  it('narrows the projects a reconcile walks to one, reading its cards from storage', async () => {
    const { refreshed, card, ctx } = await seeded();

    const scoped = await scopeIntegrationContextToProject(ctx, { orgId: 'org-1', factoryProjectId: refreshed.id });

    expect(scoped?.project.id).toBe(refreshed.id);
    const context = scoped!.context;
    expect((await context.storage.projects.listAll()).map(project => project.id)).toEqual([refreshed.id]);
    expect((await context.runtime!.keptCards!.projects()).map(project => project.id)).toEqual([refreshed.id]);
    const cards = await context.runtime!.keptCards!.cards({ orgId: 'org-1', factoryProjectId: refreshed.id });
    expect(cards.map(item => item.id)).toEqual([card.item.id]);
    // Everything else on the projects storage still works.
    await expect(context.storage.projects.get({ orgId: 'org-1', id: refreshed.id })).resolves.toMatchObject({
      id: refreshed.id,
    });
  });

  it("returns null for another org's project, an unknown project, or no Factory runtime", async () => {
    const { refreshed, ctx } = await seeded();

    await expect(
      scopeIntegrationContextToProject(ctx, { orgId: 'org-2', factoryProjectId: refreshed.id }),
    ).resolves.toBeNull();
    await expect(scopeIntegrationContextToProject(ctx, { orgId: 'org-1', factoryProjectId: 'nope' })).resolves.toBeNull();
    await expect(
      scopeIntegrationContextToProject({ ...ctx, runtime: undefined }, { orgId: 'org-1', factoryProjectId: refreshed.id }),
    ).resolves.toBeNull();
  });
});

describe('addReconcileSummary', () => {
  it('adds sweep counts and keeps at most ten error messages', () => {
    const summary = emptyIntakeRefreshSummary();
    addReconcileSummary(summary, { checked: 2, updated: 1, failed: 6, errors: Array(6).fill({ error: 'boom' }) });
    addReconcileSummary(summary, { closed: 1, observed: 3, failed: 6, errors: Array(6).fill({ error: 'bang' }) });

    expect(summary).toMatchObject({ checked: 2, updated: 1, closed: 1, observed: 3, failed: 12 });
    expect(summary.errors).toHaveLength(10);
  });
});
