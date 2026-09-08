import { describe, expect, it, vi } from 'vitest';

import { FactoryTransitionService } from './rules/transition-service.js';
import { createFactoryStorageForTests } from './storage/test-utils.js';
import { createFactoryWorkItem } from './work-item-create.js';
import type { CreateFactoryWorkItemInput } from './work-item-create.js';

const scope = { orgId: 'org-1', factoryProjectId: '11111111-2222-4333-8444-555555555555' };

async function setup() {
  const seed = await createFactoryStorageForTests();
  const transitionService = new FactoryTransitionService({ storage: seed.workItems, configVersion: 'rules-v1' });
  const input: CreateFactoryWorkItemInput = {
    ...scope,
    workItems: seed.workItems,
    transitionService,
    userId: 'user-1',
    actor: { type: 'human', id: 'user-1' },
    ingressType: 'human',
    board: 'work',
    stage: 'intake',
    input: { title: 'A manual card', board: 'work', stages: ['intake'] },
  };
  return { seed, input, transitionService };
}

describe('createFactoryWorkItem', () => {
  it('prepares the card before governed entry and returns the reloaded row without auditing', async () => {
    const { seed, input, transitionService } = await setup();
    const transition = vi.spyOn(transitionService, 'transition');
    const reload = vi.spyOn(seed.workItems, 'getForProject');
    const result = await createFactoryWorkItem({
      ...input,
      beforeEntry: async item => {
        expect(transition).not.toHaveBeenCalled();
        await seed.comments.create({
          ...scope,
          workItemId: item.id,
          author: { kind: 'user', id: 'user-1' },
          body: 'Brief',
        });
      },
    });
    expect(result.status).toBe('created');
    if (result.status !== 'created') throw new Error('Expected creation');
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        ...scope,
        workItemId: result.item.id,
        board: 'work',
        stage: 'intake',
        initialEntry: true,
        cause: 'work_item_created',
        ingress: { type: 'human', identity: `work-item:${result.item.id}:initial-entry` },
      }),
    );
    expect(reload).toHaveBeenCalledWith(scope.orgId, scope.factoryProjectId, result.item.id);
    expect(result.item).toEqual(
      await seed.workItems.getForProject(scope.orgId, scope.factoryProjectId, result.item.id),
    );
    expect((await seed.audit.list(scope)).events).toEqual([]);
  });

  it.each(['preparation', 'rejection', 'unavailable'] as const)(
    'deletes the card and its comment after %s failure',
    async failure => {
      const { seed, input, transitionService } = await setup();
      let workItemId = '';
      let commentId = '';
      const transition = vi.spyOn(transitionService, 'transition');
      if (failure === 'rejection')
        transition.mockResolvedValue({ status: 'rejected', code: 'invalid_stage', reason: 'Rejected entry' });
      const result = await createFactoryWorkItem({
        ...input,
        transitionService: failure === 'unavailable' ? undefined : transitionService,
        beforeEntry: async item => {
          workItemId = item.id;
          const comment = await seed.comments.create({
            ...scope,
            workItemId,
            author: { kind: 'user', id: 'user-1' },
            body: 'Brief',
          });
          commentId = comment.id;
          if (failure === 'preparation') throw new Error('Brief preparation failed');
        },
      });
      expect(result.status).toBe(failure === 'unavailable' ? 'unavailable' : 'rejected');
      expect(workItemId).not.toBe('');
      expect(commentId).not.toBe('');
      expect(await seed.workItems.getForProject(scope.orgId, scope.factoryProjectId, workItemId)).toBeNull();
      expect(await seed.comments.get({ orgId: scope.orgId, commentId })).toBeNull();
      expect((await seed.audit.list(scope)).events).toEqual([]);
      if (failure !== 'rejection') expect(transition).not.toHaveBeenCalled();
    },
  );

  it('reuses source-key matches without preparing or entering the card again', async () => {
    const { input, transitionService } = await setup();
    input.input.externalSource = { integrationId: 'github', type: 'issue', externalId: 'issue-1' };
    const first = await createFactoryWorkItem(input);
    expect(first.status).toBe('created');
    const transition = vi.spyOn(transitionService, 'transition');
    const beforeEntry = vi.fn();
    const reused = await createFactoryWorkItem({
      ...input,
      input: { ...input.input, title: 'Updated title' },
      beforeEntry,
    });
    expect(reused.status).toBe('reused');
    if (reused.status !== 'reused' || first.status !== 'created') throw new Error('Expected reuse');
    expect(reused.item.id).toBe(first.item.id);
    expect(reused.item.title).toBe('Updated title');
    expect(reused.previous).toBeDefined();
    expect(transition).not.toHaveBeenCalled();
    expect(beforeEntry).not.toHaveBeenCalled();
  });
});
