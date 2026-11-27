import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

import { DispatcherBoardEngine } from '../board-engine/engine.js';
import { createBoardRegistry } from '../boards/index.js';
import { PHASE_EXIT_METADATA_KEY } from '../boards/phase-automation.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { applyPhaseOutcome, observeSessionPhaseOutcome } from './phase-outcome-move.js';
import { FactoryTransitionService } from './transition-service.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

/** A Work card in Planning, worked by a bound planning session. */
async function planningCard(storage: WorkItemsStorage) {
  const prepared = await storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
        title: 'Factory item',
        stages: ['intake'],
        sessions: {},
        metadata: { authorTrusted: true },
      },
    },
    role: 'work',
    session: { sessionId: 'session-1', branch: 'factory/item', threadId: 'thread-1' },
    resourceId: 'resource-1',
    kickoffKey: 'kickoff-1',
    kickoffMessage: null,
  });
  await storage.update({ orgId: 'org-1', id: prepared.item.id, userId: 'user-1', patch: { stages: ['planning'] } });
  return prepared;
}

/** What Factory stamps once `submit_plan` comes back approved. */
async function planApproved(storage: WorkItemsStorage, id: string) {
  await storage.update({
    orgId: 'org-1',
    id,
    userId: 'agent:binding',
    patch: {
      metadata: {
        [PHASE_EXIT_METADATA_KEY]: { phase: 'planning', tool: 'submit_plan', at: new Date().toISOString() },
      },
    },
  });
}

function fakeSession() {
  const listeners = new Set<(event: AgentControllerEvent) => void>();
  return {
    subscribe(listener: (event: AgentControllerEvent) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    end(reason: 'complete' | 'suspended') {
      for (const listener of listeners) listener({ type: 'agent_end', reason } as AgentControllerEvent);
    },
  };
}

describe('applying the outcome of a phase', () => {
  it('moves a card whose plan a person approved after its run parked, once the resumed run ends', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const boards = createBoardRegistry();
    const { item, binding } = await planningCard(storage);
    const transitionService = new FactoryTransitionService({ storage, configVersion: 'rules-v1', boards });
    const engine = new DispatcherBoardEngine({ transitionService, workItems: storage, boards });
    const requestMove = vi.spyOn(engine, 'requestMove');
    const session = fakeSession();
    observeSessionPhaseOutcome(session, {
      binding: () =>
        storage.findActiveRunBindingForSession({
          orgId: 'org-1',
          factoryProjectId: PROJECT_ID,
          sessionId: 'session-1',
        }),
      boardEngine: () => engine,
    });

    // The run parks on submit_plan: nothing is approved, nothing moves.
    session.end('suspended');
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(requestMove).not.toHaveBeenCalled();

    // A person approves the plan; the resumed run ends. Approval is Planning's `advance` outcome.
    await planApproved(storage, item.id);
    session.end('complete');
    await vi.waitFor(async () =>
      expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['execute']),
    );
    expect(requestMove).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'execute',
        actor: { type: 'agent', bindingId: binding.id, role: 'work' },
        cause: 'Plan approved: submit_plan succeeded.',
      }),
    );
  });

  it('moves the card once when both the dispatcher and the session see the same run end', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const boards = createBoardRegistry();
    const { item, binding } = await planningCard(storage);
    await planApproved(storage, item.id);
    const transitionService = new FactoryTransitionService({ storage, configVersion: 'rules-v1', boards });
    const deps = {
      storage,
      boards,
      boardEngine: new DispatcherBoardEngine({ transitionService, workItems: storage, boards }),
    };

    const [first, second] = await Promise.all([applyPhaseOutcome(deps, binding), applyPhaseOutcome(deps, binding)]);

    expect([first, second]).toEqual([true, true]);
    const moved = (await storage.get({ orgId: 'org-1', id: item.id }))!;
    expect(moved.stages).toEqual(['execute']);
    expect(moved.stageHistory.filter(entry => entry.stage === 'execute')).toHaveLength(1);
    // Once the card has left Planning, the outcome no longer applies: a late run end moves nothing.
    expect(await applyPhaseOutcome(deps, binding)).toBe(false);
  });

  it('leaves the card for the run-incomplete check when the session reported nothing', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const boards = createBoardRegistry();
    const { item, binding } = await planningCard(storage);
    const requestMove = vi.fn();

    expect(await applyPhaseOutcome({ storage, boards, boardEngine: { requestMove } }, binding)).toBe(false);
    expect(requestMove).not.toHaveBeenCalled();
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['planning']);
  });
});
