import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { PHASE_EXIT_METADATA_KEY } from '../boards/phase-automation.js';
import { FactoryRuleRejectedError } from '../rules/dispatch-errors.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryTransitionRequest } from '../rules/transition-service.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { boardRunId } from './board-workflow.js';
import type { FactoryBoardEngine } from './engine.js';
import { WorkflowBoardEngine } from './workflow-engine.js';

const ORG = 'org-1';
const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

/** One process: an engine on the card storage, its workflow run by a Mastra on the shared run storage. */
function replica(storage: WorkItemsStorage, runsUrl: string, before?: () => Promise<void>) {
  const boards = createBoardRegistry();
  const transitionService = new FactoryTransitionService({ storage, configVersion: 'rules-v1', boards });
  const transition = async (request: FactoryTransitionRequest) => {
    await before?.();
    return transitionService.transition(request);
  };
  const engine = new WorkflowBoardEngine({ transitionService: { transition }, workItems: storage, boards });
  const mastra = new Mastra({
    storage: new LibSQLStore({ id: `board-runs-${randomUUID()}`, url: runsUrl }),
    workflows: engine.workflows,
    logger: false,
  });
  onTestFinished(() => mastra.shutdown().catch(() => undefined));
  return { engine, mastra };
}

/** A Work card in Planning with a bound planning session, and an engine whose workflow Mastra runs. */
async function setup() {
  const storage = (await createFactoryStorageForTests()).workItems;
  const dir = mkdtempSync(join(tmpdir(), 'factory-board-runs-'));
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
  const runsUrl = `file:${join(dir, 'runs.db')}`;
  const { engine, mastra } = replica(storage, runsUrl);
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
  return { storage, engine, mastra, runsUrl, ...prepared };
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

  it("moves nothing on a resume the engine didn't ask for, and keeps the move out of the run's snapshot", async () => {
    const { storage, engine, mastra, item } = await setup();
    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')());
    const workflow = mastra.getWorkflow('factory-board');

    // What a caller of Mastra's workflow resume API could send: a full move of its own, or a made-up input id.
    const forged = await personMove(storage, item.id, 'done', 'forged')();
    const run = await workflow.createRun({ runId: boardRunId(item.id) });
    await run
      .resume({ step: 'phase', resumeData: { input: { type: 'move', inputId: 'x', request: forged } } })
      .catch(() => undefined);
    const again = await workflow.createRun({ runId: boardRunId(item.id) });
    await again.resume({ step: 'phase', resumeData: { inputId: randomUUID() } });

    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['intake']);
    const stored = await workflow.getWorkflowRunById(boardRunId(item.id));
    expect(JSON.stringify(stored)).not.toContain('user-1');
    expect(JSON.stringify(stored)).not.toContain(ORG);
    await expect(engine.requestMove(await personMove(storage, item.id, 'done', 'drag-2')())).resolves.toMatchObject({
      status: 'accepted',
      stage: 'done',
    });
  });

  it("still moves the card when its run was started through Mastra's workflow API with input of its own", async () => {
    const { storage, engine, mastra, item } = await setup();
    const workflow = mastra.getWorkflow('factory-board');
    const seeded = await workflow.createRun({ runId: boardRunId(item.id) });
    await seeded.start({ inputData: { orgId: 'org-2', factoryProjectId: 'other', workItemId: 'other-card' } as never });

    await expect(engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')())).resolves.toMatchObject({
      status: 'accepted',
      stage: 'intake',
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

    const told = await Promise.all([engine.runEnded(binding, engine), engine.runEnded(binding, engine)]);

    // Both ask for the same move under one identity; the second gets the first's verdict, and the card moves once.
    expect(told).toEqual([true, true]);
    const moved = (await storage.get({ orgId: ORG, id: item.id }))!;
    expect(moved.stages).toEqual(['execute']);
    expect(moved.stageHistory?.filter(entry => entry.stage === 'execute')).toHaveLength(1);
  });

  it("moves the card by a run's outcome through the engine Factory holds, so a wrapping engine sees it", async () => {
    const { storage, engine, mastra, item, binding } = await setup();
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
    const seen: string[] = [];
    const wrapper: FactoryBoardEngine = {
      requestMove: request => {
        seen.push(request.stage);
        return engine.requestMove(request);
      },
      requestPlacement: placement => engine.requestPlacement(placement),
      runEnded: (ended, held) => engine.runEnded(ended, held),
    };

    await expect(wrapper.runEnded(binding, wrapper)).resolves.toBe(true);

    expect(seen).toEqual(['execute']);
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['execute']);
    // The move still went through the card's run, which waits for the next input.
    const run = await mastra.getWorkflow('factory-board').getWorkflowRunById(boardRunId(item.id));
    expect(run?.status).toBe('suspended');
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

    const refusal = await engine.runEnded(binding, engine).catch((error: unknown) => error);

    // Work's Review holds only cards with a pull request, and this card has none.
    expect(refusal).toBeInstanceOf(FactoryRuleRejectedError);
    expect(refusal).toMatchObject({ code: 'invalid_transition', settled: true });
    expect((refusal as Error).message).toContain('pull request');
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['execute']);
  });

  it('answers false for a run end with no outcome reported, leaving the card where it is', async () => {
    const { storage, engine, item, binding } = await setup();

    await expect(engine.runEnded(binding, engine)).resolves.toBe(false);
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['planning']);
  });

  it('waits its turn when another process resumed the same card first', async () => {
    const { storage, engine, runsUrl, item } = await setup();
    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-0')());
    let entered!: () => void;
    const inStep = new Promise<void>(resolve => (entered = resolve));
    let release!: () => void;
    const released = new Promise<void>(resolve => (release = resolve));
    let gated = true;
    const slow = replica(storage, runsUrl, async () => {
      if (!gated) return;
      gated = false;
      entered();
      await released;
    }).engine;
    const other = replica(storage, runsUrl).engine;
    // The other process read the run while it was still suspended, so it resumes it too.
    const suspended = await other.workflow.getWorkflowRunById(boardRunId(item.id));
    vi.spyOn(other.workflow, 'getWorkflowRunById').mockResolvedValueOnce(suspended);
    const toDone = await personMove(storage, item.id, 'done', 'drag-1')();
    const toCanceled = await personMove(storage, item.id, 'canceled', 'drag-2')();

    const first = slow.requestMove(toDone);
    await inStep;
    const second = other.requestMove(toCanceled);
    await new Promise(resolve => setTimeout(resolve, 200));
    release();

    await expect(first).resolves.toMatchObject({ status: 'accepted', stage: 'done' });
    // Applied once the first input's step suspended, as stale since both were made against one revision.
    await expect(second).resolves.toMatchObject({ status: 'rejected', code: 'stale' });
  });

  it('tries again when another caller claimed the suspended run between its read and its resume', async () => {
    const { storage, engine, item } = await setup();
    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-0')());
    // Core's answer to the resume that lost the compare-and-set on a suspended run.
    const createRun = engine.workflow.createRun.bind(engine.workflow);
    vi.spyOn(engine.workflow, 'createRun').mockImplementationOnce(async options => {
      const run = await createRun(options);
      vi.spyOn(run, 'resume').mockRejectedValueOnce(
        Object.assign(new Error('This suspended workflow run was already resumed by another caller.'), {
          id: 'WORKFLOW_RESUME_ALREADY_CLAIMED',
        }),
      );
      return run;
    });

    await expect(engine.requestMove(await personMove(storage, item.id, 'done', 'drag-1')())).resolves.toMatchObject({
      status: 'accepted',
      stage: 'done',
    });
  });

  it("starts the card's run over when its last run ended", async () => {
    const { storage, engine, mastra, item } = await setup();
    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')());
    const workflow = mastra.getWorkflow('factory-board');
    await (await workflow.createRun({ runId: boardRunId(item.id) })).cancel();
    expect((await workflow.getWorkflowRunById(boardRunId(item.id)))?.status).toBe('canceled');

    await expect(engine.requestMove(await personMove(storage, item.id, 'done', 'drag-2')())).resolves.toMatchObject({
      status: 'accepted',
      stage: 'done',
    });
    expect((await workflow.getWorkflowRunById(boardRunId(item.id)))?.status).toBe('suspended');
  });

  it('answers a committed move even when another process replaced the run while it was applied', async () => {
    const { storage, engine, mastra, runsUrl, item } = await setup();
    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-0')());
    const workflow = mastra.getWorkflow('factory-board');
    await (await workflow.createRun({ runId: boardRunId(item.id) })).cancel();
    let entered!: () => void;
    const inStep = new Promise<void>(resolve => (entered = resolve));
    let release!: () => void;
    const released = new Promise<void>(resolve => (release = resolve));
    const slow = replica(storage, runsUrl, async () => {
      entered();
      await released;
    }).engine;
    const other = replica(storage, runsUrl).engine;
    // Both processes read the ended run; the other replaces it after the slow one already did.
    const ended = await other.workflow.getWorkflowRunById(boardRunId(item.id));
    vi.spyOn(other.workflow, 'getWorkflowRunById').mockResolvedValueOnce(ended);

    const first = slow.requestMove(await personMove(storage, item.id, 'done', 'drag-1')());
    await inStep;
    await other.requestMove(await personMove(storage, item.id, 'no-such-phase', 'drag-2')());
    release();

    await expect(first).resolves.toMatchObject({ status: 'accepted', stage: 'done' });
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['done']);
  });

  it('moves the card on the run another process replaced, after this process saw its own end', async () => {
    const { storage, engine, mastra, runsUrl, item } = await setup();
    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-0')());
    const workflow = mastra.getWorkflow('factory-board');
    await (await workflow.createRun({ runId: boardRunId(item.id) })).cancel();
    const other = replica(storage, runsUrl).engine;
    await other.requestMove(await personMove(storage, item.id, 'no-such-phase', 'drag-1')());

    await expect(engine.requestMove(await personMove(storage, item.id, 'done', 'drag-2')())).resolves.toMatchObject({
      status: 'accepted',
      stage: 'done',
    });
  });

  it("claims the card's run afresh when asked from work that carries an older claim on it", async () => {
    const { storage, engine, item } = await setup();
    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')());
    await engine.requestMove(await personMove(storage, item.id, 'planning', 'drag-2')());
    // What a session a step of this run started still carries: the claim that step held, since replaced.
    const context = (globalThis as Record<symbol, { run<T>(scope: unknown, fn: () => T): T } | undefined>)[
      Symbol.for('mastra.storage.runFenceContext')
    ]!;
    const staleClaim = {
      fenceFor: (_store: object, runId?: string) =>
        runId ? { runId, generation: 1, ownerId: 'finished-step' } : undefined,
    };

    const move = await personMove(storage, item.id, 'intake', 'drag-3')();

    await expect(context.run(staleClaim, () => engine.requestMove(move))).resolves.toMatchObject({
      status: 'accepted',
      stage: 'intake',
    });
  });

  it('refuses inputs while its workflow is not registered with Mastra', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const boards = createBoardRegistry();
    const transitionService = new FactoryTransitionService({ storage, configVersion: 'rules-v1', boards });
    const engine = new WorkflowBoardEngine({ transitionService, workItems: storage, boards });

    await expect(
      engine.requestMove({
        orgId: ORG,
        factoryProjectId: PROJECT_ID,
        workItemId: 'card',
        board: 'work',
        stage: 'intake',
        expectedRevision: 1,
        actor: { type: 'human', id: 'user-1' },
        ingress: { type: 'human', identity: 'drag-1' },
        cause: 'Dragged on the board.',
      }),
    ).rejects.toThrow('not registered with Mastra');
  });
});
