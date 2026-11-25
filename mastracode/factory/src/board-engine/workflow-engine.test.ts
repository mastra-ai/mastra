import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { PHASE_EXIT_METADATA_KEY } from '../boards/phase-automation.js';
import { FactoryRuleRejectedError } from '../rules/dispatch-errors.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryTransitionRequest } from '../rules/transition-service.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { boardRunId } from './board-workflow.js';
import { WorkflowBoardEngine } from './workflow-engine.js';

const ORG = 'org-1';
const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

/** A Work card in Planning with a bound planning session, and an engine whose workflow Mastra runs. */
async function setup() {
  const storage = (await createFactoryStorageForTests()).workItems;
  const boards = createBoardRegistry();
  const transitionService = new FactoryTransitionService({ storage, configVersion: 'rules-v1', boards });
  const engine = new WorkflowBoardEngine({ transitionService, workItems: storage, boards });
  const mastra = new Mastra({
    storage: new LibSQLStore({ id: 'board-runs', url: ':memory:' }),
    workflows: engine.workflows,
    logger: false,
  });
  onTestFinished(() => mastra.shutdown().catch(() => undefined));
  const prepared = await storage.prepareRunStart({
    orgId: ORG,
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
  await storage.update({ orgId: ORG, id: prepared.item.id, userId: 'user-1', patch: { stages: ['planning'] } });
  return { storage, engine, mastra, ...prepared };
}

function personMove(storage: WorkItemsStorage, id: string, stage: string, identity: string) {
  return async (): Promise<FactoryTransitionRequest> => {
    const item = (await storage.get({ orgId: ORG, id }))!;
    return {
      orgId: ORG,
      factoryProjectId: PROJECT_ID,
      workItemId: id,
      board: 'work',
      stage,
      expectedRevision: item.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity },
      cause: 'Dragged on the board.',
    };
  };
}

describe('the workflow board engine', () => {
  it("moves a card through the card's one board run, answering each request with the transition's result", async () => {
    const { storage, engine, mastra, item } = await setup();

    const result = await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')());

    expect(result).toMatchObject({ status: 'accepted' });
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['intake']);
    const run = await mastra.getWorkflow('factory-board').getWorkflowRunById(boardRunId(item.id));
    expect(run?.status).toBe('suspended');
  });

  it('answers with the refusal the transition service gave, and keeps waiting for the next input', async () => {
    const { storage, engine, item } = await setup();

    const refusal = await engine.requestMove(await personMove(storage, item.id, 'no-such-phase', 'drag-1')());

    expect(refusal).toMatchObject({ status: 'rejected', code: 'invalid_transition', itemId: item.id });
    await expect(engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-2')())).resolves.toMatchObject({
      status: 'accepted',
    });
  });

  it('applies requests made at once one after another, each against the revision it was made for', async () => {
    const { storage, engine, item } = await setup();
    const toIntake = await personMove(storage, item.id, 'intake', 'drag-1')();
    const toDone = await personMove(storage, item.id, 'done', 'drag-2')();

    const [first, second] = await Promise.all([engine.requestMove(toIntake), engine.requestMove(toDone)]);

    expect(first).toMatchObject({ status: 'accepted', stage: 'intake' });
    // Both were made against the same revision, so the second is refused as stale, not lost or applied twice.
    expect(second).toMatchObject({ status: 'rejected', code: 'stale' });
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['intake']);
  });

  it('moves the card by the outcome of the phase once, however many times the run end is told', async () => {
    const { storage, engine, item, binding } = await setup();
    await storage.update({
      orgId: ORG,
      id: item.id,
      userId: 'agent:binding',
      patch: {
        metadata: {
          [PHASE_EXIT_METADATA_KEY]: { phase: 'planning', tool: 'submit_plan', at: new Date().toISOString() },
        },
      },
    });

    const told = await Promise.all([engine.runEnded(binding), engine.runEnded(binding)]);

    expect(told).toEqual([true, false]);
    const moved = (await storage.get({ orgId: ORG, id: item.id }))!;
    expect(moved.stages).toEqual(['execute']);
    expect(moved.stageHistory?.filter(entry => entry.stage === 'execute')).toHaveLength(1);
  });

  it("throws the board's refusal of a reported outcome as the rule rejection the dispatcher settles", async () => {
    const { storage, engine, item, binding } = await setup();
    await storage.update({ orgId: ORG, id: item.id, userId: 'user-1', patch: { stages: ['execute'] } });
    await storage.update({
      orgId: ORG,
      id: item.id,
      userId: 'agent:binding',
      patch: {
        metadata: {
          phaseOutcome: {
            phase: 'execute',
            outcome: 'review',
            to: 'pr-review',
            reason: 'Opened a change request.',
            source: 'reported',
            at: new Date().toISOString(),
            bindingId: binding.id,
          },
        },
      },
    });

    const refusal = await engine.runEnded(binding).catch((error: unknown) => error);

    // Work's Review holds only cards with a pull request, and this card has none.
    expect(refusal).toBeInstanceOf(FactoryRuleRejectedError);
    expect(refusal).toMatchObject({ code: 'invalid_transition', settled: true });
    expect((refusal as Error).message).toContain('pull request');
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['execute']);
  });

  it('answers false for a run end with no outcome reported, leaving the card where it is', async () => {
    const { storage, engine, item, binding } = await setup();

    await expect(engine.runEnded(binding)).resolves.toBe(false);
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['planning']);
  });

  it('refuses inputs while its workflow is not registered with Mastra', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const boards = createBoardRegistry();
    const transitionService = new FactoryTransitionService({ storage, configVersion: 'rules-v1', boards });
    const engine = new WorkflowBoardEngine({ transitionService, workItems: storage, boards });

    await expect(
      engine.runEnded({ id: 'b', role: 'work', orgId: ORG, factoryProjectId: PROJECT_ID, workItemId: 'card' }),
    ).rejects.toThrow('not registered with Mastra');
  });
});
