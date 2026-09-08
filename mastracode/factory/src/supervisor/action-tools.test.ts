import { describe, expect, it, vi } from 'vitest';
import { createBoardRegistry } from '../boards/index.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createFactorySupervisorActionTools } from './action-tools.js';

const scope = { orgId: 'org-1', factoryProjectId: '11111111-2222-4333-8444-555555555555' };
async function setup() {
  const seed = await createFactoryStorageForTests();
  const transitionService = new FactoryTransitionService({ storage: seed.workItems, configVersion: 'rules-v1' });
  const deps = {
    ...seed,
    scope,
    userId: 'user-1',
    boards: createBoardRegistry(),
    transitionService,
    messageAuthor: { id: 'user-1', name: 'Caleb Barnes', avatarUrl: 'https://example.com/avatar.png' },
    email: 'caleb@example.com',
  };
  return { ...seed, deps, transitionService };
}
function tool(deps: Parameters<typeof createFactorySupervisorActionTools>[0]) {
  return createFactorySupervisorActionTools(deps).factory_create_work_item;
}
function execute(target: unknown) {
  return (target as { execute: (input: unknown, context: unknown) => Promise<{ workItemId: string }> }).execute(
    { title: 'Test card', brief: 'The worker brief' },
    {},
  );
}

describe('factory_create_work_item', () => {
  it('files for the person with their display snapshot before intake, approval-free and audited once', async () => {
    const { deps, workItems, comments, audit, transitionService } = await setup();
    const target = tool(deps);
    expect(target.requireApproval).toBe(false);
    const transition = vi.spyOn(transitionService, 'transition');
    const create = vi.spyOn(comments, 'create');
    const result = await execute(target);
    expect(result).toMatchObject({ requestedBy: 'user-1', stages: ['intake'], briefPosted: true });
    const item = await workItems.getForProject(scope.orgId, scope.factoryProjectId, result.workItemId);
    expect(item).toMatchObject({ createdBy: 'user-1' });
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(transition.mock.invocationCallOrder[0]!);
    const page = await comments.list({ ...scope, workItemId: result.workItemId });
    expect(page.comments).toHaveLength(1);
    expect(page.comments[0]).toMatchObject({
      body: 'The worker brief',
      author: { kind: 'user', id: 'user-1', displayName: 'Caleb Barnes', avatarUrl: 'https://example.com/avatar.png' },
    });
    const events = (await audit.list(scope)).events;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: 'factory.work_item.created',
      actorId: 'user-1',
      actorType: 'human',
      metadata: { cause: 'supervisor', requestedBy: 'user-1', briefPosted: true },
    });
  });

  it('uses email as the display fallback', async () => {
    const { deps, comments } = await setup();
    const result = await execute(tool({ ...deps, messageAuthor: undefined }));
    expect((await comments.list({ ...scope, workItemId: result.workItemId })).comments[0]?.author.displayName).toBe(
      'caleb@example.com',
    );
  });

  it.each(['comment', 'rejection', 'unavailable'] as const)(
    'leaves no card, comment or audit on %s failure',
    async failure => {
      const { deps, workItems, comments, audit, transitionService } = await setup();
      let workItemId = '';
      const create = comments.create.bind(comments);
      vi.spyOn(comments, 'create').mockImplementation(async input => {
        workItemId = input.workItemId;
        const comment = await create(input);
        if (failure === 'comment') throw new Error('Comment persistence failed');
        return comment;
      });
      if (failure === 'rejection')
        vi.spyOn(transitionService, 'transition').mockResolvedValue({
          status: 'rejected',
          code: 'invalid_stage',
          reason: 'Entry rejected',
        });
      await expect(
        execute(tool({ ...deps, transitionService: failure === 'unavailable' ? undefined : transitionService })),
      ).rejects.toThrow();
      expect(workItemId).not.toBe('');
      expect(await workItems.list(scope)).toEqual([]);
      expect((await comments.list({ ...scope, workItemId })).comments).toEqual([]);
      expect((await audit.list(scope)).events).toEqual([]);
    },
  );

  it('accepts only title and brief with bounded lengths', async () => {
    const { deps } = await setup();
    const schema = tool(deps).inputSchema;
    expect(schema?.safeParse({ title: 'test', brief: 'brief', stage: 'execute' }).success).toBe(false);
    expect(schema?.safeParse({ title: ' ', brief: 'brief' }).success).toBe(false);
    expect(schema?.safeParse({ title: 'x'.repeat(201), brief: 'brief' }).success).toBe(false);
    expect(schema?.safeParse({ title: 'test', brief: '' }).success).toBe(false);
    expect(schema?.safeParse({ title: 'test', brief: 'x'.repeat(4001) }).success).toBe(false);
  });
});
