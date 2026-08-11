import { describe, expect, it, vi } from 'vitest';

const prepareStart = vi.hoisted(() => vi.fn());
vi.mock('./start-coordinator.js', async importOriginal => {
  const actual = await importOriginal<typeof import('./start-coordinator.js')>();
  return {
    ...actual,
    FactoryStartCoordinator: class {
      prepare = prepareStart;
    },
  };
});

import { createFactoryAutomationCommands } from './automation-commands.js';

describe('Factory automation commands', () => {
  it('validates repository ownership and creates a collision-safe Factory source session', async () => {
    prepareStart.mockResolvedValueOnce({ workItemId: 'item-1' });
    const create = vi.fn(async input => ({ ...input }));
    const sourceControl = {
      projectRepositories: {
        get: vi.fn(async () => ({ id: 'repo-link-1', connectionId: 'connection-1', branch: 'develop' })),
      },
      connections: { get: vi.fn(async () => ({ factoryProjectId: 'project-1' })) },
      sessions: { getForBranch: vi.fn(async () => null), create },
    };
    const commands = createFactoryAutomationCommands({
      integrationId: 'github-projects',
      controller: {} as never,
      storage: {} as never,
      transitionService: { transition: vi.fn() },
      sourceControl: sourceControl as never,
    });

    await commands.startWorkItem({
      orgId: 'org-1',
      userId: 'automation-user',
      factoryProjectId: 'project-1',
      projectRepositoryId: 'repo-link-1',
      projectItemNodeId: 'PVTI_1',
      contentNodeId: 'I_global_42',
      repositoryNameWithOwner: 'acme/api',
      number: 42,
      title: 'Fix auth',
      url: 'https://github.com/acme/api/issues/42',
      kickoffKey: 'delivery-1',
      prompt: 'Implement the issue from its canonical URL.',
      role: 'work',
      destinationStage: 'execute',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRepositoryId: 'repo-link-1',
        orgId: 'org-1',
        userId: 'automation-user',
        baseBranch: 'develop',
        branch: expect.stringMatching(/^factory\/issue-42-[a-f0-9]{10}$/),
      }),
    );
    expect(prepareStart).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { type: 'system', id: 'integration:github-projects' },
        sessionId: expect.any(String),
        workItem: expect.objectContaining({
          input: expect.objectContaining({
            externalSource: expect.objectContaining({ externalId: 'I_global_42' }),
          }),
        }),
      }),
    );
  });

  it('stamps transitions with the integration actor and a namespaced idempotency identity', async () => {
    const transition = vi.fn(async input => ({
      status: 'committed' as const,
      transitionId: 'transition-1',
      itemId: input.workItemId,
      revision: 3,
      stage: input.stage,
      decisions: [],
    }));
    const commands = createFactoryAutomationCommands({
      integrationId: 'github-projects',
      controller: {} as never,
      storage: { listRunBindings: vi.fn() } as never,
      transitionService: { transition },
    });

    await commands.transitionWorkItem({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItemId: 'item-1',
      board: 'work',
      stage: 'execute',
      expectedRevision: 2,
      cause: 'projects_v2_status_change',
      idempotencyKey: 'delivery-1',
    });

    expect(transition).toHaveBeenCalledWith({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItemId: 'item-1',
      board: 'work',
      stage: 'execute',
      expectedRevision: 2,
      cause: 'projects_v2_status_change',
      actor: { type: 'system', id: 'integration:github-projects' },
      ingress: { type: 'rule', identity: 'automation:github-projects:delivery-1' },
    });
  });

  it('returns only the newest active binding for the requested work item', async () => {
    const revoked = { id: 'binding-1', status: 'revoked' };
    const active = { id: 'binding-2', status: 'active' };
    const listRunBindings = vi.fn(async () => [revoked, active]);
    const commands = createFactoryAutomationCommands({
      integrationId: 'github-projects',
      controller: {} as never,
      storage: { listRunBindings } as never,
      transitionService: { transition: vi.fn() },
    });

    await expect(
      commands.getActiveRun({ orgId: 'org-1', factoryProjectId: 'project-1', workItemId: 'item-1' }),
    ).resolves.toBe(active);
    expect(listRunBindings).toHaveBeenCalledWith('org-1', 'project-1', 'item-1');
  });

  it('reads a work item only through its exact tenant and project boundary', async () => {
    const item = { id: 'item-1', stages: ['review'] };
    const getForProject = vi.fn(async () => item);
    const commands = createFactoryAutomationCommands({
      integrationId: 'github-projects',
      controller: {} as never,
      storage: { getForProject } as never,
      transitionService: { transition: vi.fn() },
    });

    await expect(
      commands.getWorkItem({ orgId: 'org-1', factoryProjectId: 'project-1', workItemId: 'item-1' }),
    ).resolves.toBe(item);
    expect(getForProject).toHaveBeenCalledWith('org-1', 'project-1', 'item-1');
  });
});
