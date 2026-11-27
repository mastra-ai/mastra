import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';

import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createBoardRegistry, defineBoard } from '../boards/index.js';
import { PHASE_EXIT_METADATA_KEY } from '../boards/phase-automation.js';
import { FactoryRuleRejectedError } from '../rules/dispatch-errors.js';
import { observeSessionPhaseOutcome } from '../rules/phase-outcome-move.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryTransitionRequest } from '../rules/transition-service.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { boardRunId } from './board-workflow.js';
import { DispatcherBoardEngine } from './engine.js';
import type { FactoryBoardEngine, FactoryCardRuns } from './engine.js';
import { createWorkflowBoardEngine, WorkflowBoardEngine } from './workflow-engine.js';
import type { WorkflowBoardEngineOptions } from './workflow-engine.js';

const ORG = 'org-1';
const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

/** One process: an engine on the card storage, its workflow run by a Mastra on the shared run storage. */
function replica(
  storage: WorkItemsStorage,
  runsUrl: string,
  before?: () => Promise<void>,
  runs?: FactoryCardRuns,
  interruptWaitMs?: number,
  deadlines?: WorkflowBoardEngineOptions['deadlines'],
) {
  const boards = createBoardRegistry();
  const transitionService = new FactoryTransitionService({
    storage,
    configVersion: 'rules-v1',
    boards,
    ...(runs ? { runInFlight: runs.inFlight } : {}),
  });
  const transition = async (request: FactoryTransitionRequest) => {
    await before?.();
    return transitionService.transition(request);
  };
  const context = { transitionService: { transition }, workItems: storage, boards, ...(runs ? { runs } : {}) };
  const engine = deadlines
    ? createWorkflowBoardEngine({ deadlines })(context)
    : new WorkflowBoardEngine(context, { interruptWaitMs });
  const mastra = new Mastra({
    storage: new LibSQLStore({ id: `board-runs-${randomUUID()}`, url: runsUrl }),
    workflows: engine.workflows,
    logger: false,
  });
  onTestFinished(() => mastra.shutdown().catch(() => undefined));
  return { engine, mastra };
}

/** A Work card in Planning with a bound planning session, and an engine whose workflow Mastra runs. */
async function setup({
  deadlines,
  runs,
}: { deadlines?: WorkflowBoardEngineOptions['deadlines']; runs?: FactoryCardRuns } = {}) {
  const storage = (await createFactoryStorageForTests()).workItems;
  const dir = mkdtempSync(join(tmpdir(), 'factory-board-runs-'));
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
  const runsUrl = `file:${join(dir, 'runs.db')}`;
  const { engine, mastra } = replica(storage, runsUrl, undefined, runs, undefined, deadlines);
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
  // Told as the dispatcher tells it: a run that ended without an outcome is run once more.
  return { storage, engine, mastra, runsUrl, ...prepared, binding: { ...prepared.binding, runsAgain: true } };
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
  /** A card whose planning run is going until it is stopped, or forever when `ends` is false. */
  function goingRun(ends: boolean, reached = true) {
    const calls: string[] = [];
    const stoppedFor: string[] = [];
    let inFlight = true;
    const runs: FactoryCardRuns = {
      inFlight: async () => inFlight,
      stop: async (_card, by) => {
        calls.push('stop');
        stoppedFor.push(by.userId);
        if (ends) setTimeout(() => (inFlight = false), 20);
        return reached;
      },
    };
    return { calls, runs, stoppedFor, again: () => (inFlight = true) };
  }

  it('stops the run on a card a person moves into another phase that runs, and commits the move once it ended', async () => {
    const { storage, runsUrl, item } = await setup();
    const { calls, runs } = goingRun(true);
    const { engine, mastra } = replica(storage, runsUrl, undefined, runs);

    const result = await engine.requestMove(await personMove(storage, item.id, 'execute', 'drag-1')());

    expect(result).toMatchObject({ status: 'accepted', stage: 'execute' });
    expect(calls).toEqual(['stop']);
    // That the run was stopped for the move is told to the transition only: nothing keeps it.
    const kept = JSON.stringify([
      await mastra.getWorkflow('factory-board').getWorkflowRunById(boardRunId(item.id)),
      await storage.get({ orgId: ORG, id: item.id }),
      await storage.listDeferredDecisions(ORG, PROJECT_ID),
      await storage.getTransitionResultByIngress(ORG, PROJECT_ID, 'drag-1'),
    ]);
    expect(kept).toContain('execute');
    expect(kept).not.toContain('interruptedRun');
  });

  it('stops no run for a move it already answered, asked again as another move', async () => {
    const { storage, runsUrl, item } = await setup();
    const { calls, runs, stoppedFor, again } = goingRun(true);
    const { engine } = replica(storage, runsUrl, undefined, runs);
    const first = await engine.requestMove(await personMove(storage, item.id, 'execute', 'drag-1')());
    expect(stoppedFor).toEqual(['user-1']);

    // Building's run is going when the same request id comes back, asking for a move the board allows.
    again();
    const repeated = await engine.requestMove(await personMove(storage, item.id, 'planning', 'drag-1')());

    expect(repeated).toEqual(first);
    expect(calls).toEqual(['stop']);
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['execute']);
  });

  it.each(['workflow', 'dispatcher'] as const)(
    "refuses a busy card's move that only claims its run was stopped (%s engine)",
    async kind => {
      const { storage, runsUrl, item } = await setup();
      // Neither engine can stop runs here, and the transition service sees one going.
      const boards = createBoardRegistry();
      const transitionService = new FactoryTransitionService({
        storage,
        configVersion: 'rules-v1',
        boards,
        runInFlight: async () => true,
      });
      const context = { transitionService, workItems: storage, boards };
      const workflow = new WorkflowBoardEngine(context);
      const mastra = new Mastra({
        storage: new LibSQLStore({ id: `board-runs-${randomUUID()}`, url: runsUrl }),
        workflows: workflow.workflows,
        logger: false,
      });
      onTestFinished(() => mastra.shutdown().catch(() => undefined));
      const engine = kind === 'workflow' ? workflow : new DispatcherBoardEngine(context);

      // Whatever a caller writes on the request, the card's run was not stopped for it.
      const result = await engine.requestMove({
        ...(await personMove(storage, item.id, 'execute', 'drag-1')()),
        interruptedRun: true,
      } as FactoryTransitionRequest);

      expect(result).toMatchObject({ status: 'rejected', code: 'card_busy' });
    },
  );

  it("ends a deleted card's run, after the inputs asked before the delete", async () => {
    const { storage, engine, mastra, item } = await setup();
    const workflow = mastra.getWorkflow('factory-board');
    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')());
    expect(await workflow.getWorkflowRunById(boardRunId(item.id))).toMatchObject({ status: 'suspended' });

    const move = engine.requestMove(await personMove(storage, item.id, 'done', 'drag-2')());
    // The move is in the card's queue once its checks, which wait on nothing here, are through.
    await new Promise(resolve => setImmediate(resolve));
    const deleted = engine.cardDeleted({ workItemId: item.id });

    expect(await move).toMatchObject({ status: 'accepted' });
    await deleted;
    expect(await workflow.getWorkflowRunById(boardRunId(item.id))).toBeNull();
    expect(await engine.describe({ workItemId: item.id })).toBeUndefined();
    // A card with no run is nothing to end.
    await expect(engine.cardDeleted({ workItemId: randomUUID() })).resolves.toBeUndefined();
  });

  it("starts no run for a card that is gone, when its session's run ends or pauses or it is moved after the delete", async () => {
    const { storage, engine, mastra, item, binding } = await setup();
    const workflow = mastra.getWorkflow('factory-board');
    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')());
    const late = await personMove(storage, item.id, 'done', 'drag-2')();
    await storage.delete({ orgId: ORG, id: item.id });
    await engine.cardDeleted({ workItemId: item.id });

    // Deleting a card doesn't stop its session, whose run can end long after.
    await expect(engine.runEnded(binding, engine)).resolves.toBe(false);
    await expect(engine.runPaused(binding)).resolves.toBeUndefined();
    await expect(engine.requestMove(late)).resolves.toMatchObject({ status: 'rejected' });

    expect(await workflow.getWorkflowRunById(boardRunId(item.id))).toBeNull();
  });

  it("refuses a person's move as busy, leaving the run be, when the stopped run doesn't end in time", async () => {
    const { storage, runsUrl, item } = await setup();
    const { calls, runs } = goingRun(false);
    const { engine } = replica(storage, runsUrl, undefined, runs, 120);

    const result = await engine.requestMove(await personMove(storage, item.id, 'execute', 'drag-1')());

    expect(result).toMatchObject({ status: 'rejected', code: 'card_busy' });
    expect(calls).toEqual(['stop']);
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['planning']);
  });

  it("refuses a person's move as busy at once when the run isn't this process's to stop", async () => {
    const { storage, runsUrl, item } = await setup();
    const { calls, runs } = goingRun(false, false);
    // A wait no test would sit through: the refusal must not take it.
    const { engine } = replica(storage, runsUrl, undefined, runs, 600_000);

    const result = await engine.requestMove(await personMove(storage, item.id, 'execute', 'drag-1')());

    expect(result).toMatchObject({ status: 'rejected', code: 'card_busy' });
    expect(calls).toEqual(['stop']);
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['planning']);
  });

  it('takes on a move that looks good and answers it later, and answers one its first checks refuse on the spot', async () => {
    const { storage, runsUrl, item } = await setup();
    // Holds the commits back, so a move can be asked while the one before it hasn't landed.
    const held = Promise.withResolvers<void>();
    let hold = false;
    const { engine } = replica(storage, runsUrl, () => (hold ? held.promise : undefined));

    // No such edge, and a revision the card has moved past: answered like any move.
    const noEdge = await engine.submitMove(await personMove(storage, item.id, 'pr-review', 'drag-1')());
    expect(noEdge).toMatchObject({ answered: { status: 'rejected', code: 'invalid_transition' } });
    const stale = await engine.submitMove({
      ...(await personMove(storage, item.id, 'done', 'drag-2')()),
      expectedRevision: item.revision + 5,
    });
    expect(stale).toMatchObject({ answered: { status: 'rejected', code: 'stale' } });
    hold = true;
    // Two moves from the revision a person saw both look good; only the commit tells the second it lost.
    const seen = await personMove(storage, item.id, 'execute', 'drag-3')();
    const first = await engine.submitMove(seen);
    const second = await engine.submitMove({
      ...seen,
      stage: 'done',
      ingress: { type: 'human', identity: 'drag-4' },
    });
    held.resolve();
    if (!('inputId' in first) || !('inputId' in second)) throw new Error('A move was answered on the spot.');
    expect(second.inputId).not.toBe(first.inputId);
    expect(await first.settled).toMatchObject({ status: 'accepted', stage: 'execute' });
    expect(await second.settled).toMatchObject({ status: 'rejected', code: 'stale' });

    // A move no person made isn't one the board waits on.
    const ruled = await engine.submitMove({
      ...(await personMove(storage, item.id, 'intake', 'rule-1')()),
      actor: { type: 'system', id: 'factory' },
      ingress: { type: 'rule', identity: 'rule-1' },
    } as FactoryTransitionRequest);
    expect(ruled).toHaveProperty('answered');
  });

  it('stops nothing for a move the board would refuse, a move no person made, or a move to a phase that runs nothing', async () => {
    const { storage, runsUrl, item } = await setup();
    const { calls, runs } = goingRun(true);
    const { engine } = replica(storage, runsUrl, undefined, runs);
    const move = (stage: string) => personMove(storage, item.id, stage, `drag-${stage}`)();

    // No such edge, and a revision the card has moved past.
    expect(await engine.requestMove(await move('pr-review'))).toMatchObject({
      status: 'rejected',
      code: 'invalid_transition',
    });
    expect(await engine.requestMove({ ...(await move('execute')), expectedRevision: 1 })).toMatchObject({
      status: 'rejected',
      code: 'stale',
    });
    await engine.requestMove({
      ...(await move('execute')),
      actor: { type: 'rule', id: 'rule-1' },
      ingress: { type: 'rule', identity: 'rule-1:execute' },
      expectedRevision: 1,
    });
    expect(calls).toEqual([]);
    // Intake runs nothing: the run keeps going while the card rests there.
    expect(await engine.requestMove(await move('intake'))).toMatchObject({ status: 'accepted' });
    expect(calls).toEqual([]);
  });

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

  it('records what the card is doing after each move, by the phase it lands in', async () => {
    const { storage, engine, item } = await setup();
    await expect(engine.describe({ workItemId: item.id })).resolves.toBeUndefined();

    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')());
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'resting',
      phase: 'intake',
      probes: 0,
    });

    // A refused move leaves what the card was doing as it was.
    await expect(
      engine.requestMove(await personMove(storage, item.id, 'no-such-phase', 'drag-2')()),
    ).resolves.toMatchObject({ status: 'rejected' });
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'resting',
      phase: 'intake',
      probes: 0,
    });

    await engine.requestMove(await personMove(storage, item.id, 'done', 'drag-3')());
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'terminal',
      phase: 'done',
      probes: 0,
    });
  });

  it('records a working phase as running once its run has a go-ahead, and as awaiting its start until then', async () => {
    const { storage, engine, item, binding } = await setup();
    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')());
    const into = async (stage: string, identity: string) => ({
      ...(await personMove(storage, item.id, stage, identity)()),
      ingress: { type: 'rule' as const, identity },
    });

    // A rule's move carries nobody's go-ahead, and Planning doesn't start on its own.
    await expect(
      engine.requestMove({ ...(await into('planning', 'rule-1')), actor: { type: 'system', id: 'rule' } }),
    ).resolves.toMatchObject({ status: 'accepted', stage: 'planning' });
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'awaiting_start',
      phase: 'planning',
      probes: 0,
    });

    // A move on an outside author's pull request event starts no run without a person, even from
    // a mover whose moves otherwise are the go-ahead.
    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-2')());
    await expect(
      engine.requestMove({
        ...(await into('planning', 'rule-2')),
        actor: { type: 'agent', id: 'agent:binding' },
        untrustedPullRequestEvent: true,
      }),
    ).resolves.toMatchObject({ status: 'accepted', stage: 'planning' });
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({
      state: 'awaiting_start',
      phase: 'planning',
    });

    // The card's own session ending the phase is the go-ahead for the next phase's run.
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
    await expect(engine.runEnded(binding, engine)).resolves.toBe(true);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'running',
      deadlineAt: expect.any(Number),
      phase: 'execute',
      probes: 0,
      lastOutcome: 'advance',
    });
  });

  it("counts no probe for a run end nobody follows with another run, like a person's chat turn", async () => {
    const { engine, item, binding } = await setup();
    const chat = { ...binding, runsAgain: undefined };
    await engine.runEnded({ ...binding, runEnd: 'run-1' }, engine);
    const probing = { state: 'probing', deadlineAt: expect.any(Number), phase: 'planning', probes: 1 };
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual(probing);

    await expect(engine.runEnded({ ...chat, runEnd: 'run-2' }, engine)).resolves.toBe(false);
    await expect(engine.runEnded({ ...chat, runEnd: 'run-3' }, engine)).resolves.toBe(false);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual(probing);

    // The dispatcher's telling still counts for a run the session's own telling came first for.
    await expect(engine.runEnded({ ...binding, runEnd: 'run-3' }, engine)).resolves.toBe(false);
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({
      state: 'needs_attention',
      probes: 2,
    });
  });

  it("starts the record over when the card moves to another board's phase of the same name", async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const dir = mkdtempSync(join(tmpdir(), 'factory-board-runs-'));
    onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
    // A board whose Planning is where cards rest; Work's Planning runs the planning agent.
    const parked = defineBoard({
      id: 'parked',
      name: 'Parked',
      initialPhase: 'planning',
      phases: {
        planning: { name: 'Planning', kind: 'resting', nextPhases: ['done'] },
        done: { name: 'Done', kind: 'terminal' },
      },
    });
    const boards = createBoardRegistry({ boards: [parked] });
    const engine = new WorkflowBoardEngine({
      transitionService: new FactoryTransitionService({ storage, configVersion: 'rules-v1', boards }),
      workItems: storage,
      boards,
    });
    const mastra = new Mastra({
      storage: new LibSQLStore({ id: `board-runs-${randomUUID()}`, url: `file:${join(dir, 'runs.db')}` }),
      workflows: engine.workflows,
      logger: false,
    });
    onTestFinished(() => mastra.shutdown().catch(() => undefined));
    const { item, binding } = await storage.prepareRunStart({
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
    await storage.update({ orgId: ORG, id: item.id, userId: 'user-1', patch: { stages: ['planning'] } });
    await engine.runEnded({ ...binding, runEnd: 'run-1', runsAgain: true }, engine);
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({
      state: 'probing',
      deadlineAt: expect.any(Number),
      probes: 1,
    });

    const move = await personMove(storage, item.id, 'planning', 'drag-1')();
    await expect(engine.requestMove({ ...move, board: 'parked' })).resolves.toMatchObject({ status: 'accepted' });

    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'resting',
      phase: 'planning',
      probes: 0,
    });
  });

  it('keeps what the card is doing when a move it already applied is asked again', async () => {
    const { storage, engine, item, binding } = await setup();
    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')());
    const byAgent: FactoryTransitionRequest = {
      ...(await personMove(storage, item.id, 'planning', 'agent-1')()),
      actor: { type: 'agent', id: 'agent:binding' },
      ingress: { type: 'agent', identity: 'agent-1' },
    };
    const first = await engine.requestMove(byAgent);
    expect(first).toMatchObject({ status: 'accepted' });
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({
      state: 'running',
      deadlineAt: expect.any(Number),
      probes: 0,
    });
    await engine.runEnded({ ...binding, runEnd: 'run-1' }, engine);
    await engine.runEnded({ ...binding, runEnd: 'run-2' }, engine);
    const flagged = await engine.describe({ workItemId: item.id });
    expect(flagged).toMatchObject({ state: 'needs_attention', phase: 'planning', probes: 2 });

    // The transition service answers the repeat with the first move's result, the run it queued included.
    await expect(engine.requestMove(byAgent)).resolves.toEqual(first);

    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual(flagged);
  });

  it('counts nothing for a run end told again after a later run ended', async () => {
    const { engine, item, binding } = await setup();

    await engine.runEnded({ ...binding, runEnd: 'run-1' }, engine);
    await engine.runEnded({ ...binding, runEnd: 'run-2' }, engine);
    await engine.runEnded({ ...binding, runEnd: 'run-1' }, engine);
    await engine.runEnded({ ...binding, runEnd: 'run-2' }, engine);

    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({
      state: 'needs_attention',
      probes: 2,
    });
  });

  it('probes a run that ended without an outcome, and flags the card when the next one ends the same way', async () => {
    const { storage, engine, item, binding } = await setup();

    await expect(engine.runEnded({ ...binding, runEnd: 'run-1' }, engine)).resolves.toBe(false);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'probing',
      deadlineAt: expect.any(Number),
      phase: 'planning',
      probes: 1,
    });

    await expect(engine.runEnded({ ...binding, runEnd: 'run-2' }, engine)).resolves.toBe(false);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'needs_attention',
      phase: 'planning',
      probes: 2,
      reason: "The agent's run ended twice without reporting how the phase ended.",
    });
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['planning']);
  });

  it('flags the card at once when the run that ended without an outcome will not be run again', async () => {
    const { engine, item, binding } = await setup();

    // The dispatcher's attempts were spent on an earlier failure: this end is the phase's last.
    await expect(engine.runEnded({ ...binding, runEnd: 'run-1', runsAgain: false }, engine)).resolves.toBe(false);

    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'needs_attention',
      phase: 'planning',
      probes: 1,
      reason: "The agent's run ended without reporting how the phase ended, and it will not be run again.",
    });
  });

  it('counts failed attempts at the phase, and flags the card with the last failure’s label', async () => {
    const { storage, engine, mastra, item, binding } = await setup();
    const card = { orgId: ORG, factoryProjectId: PROJECT_ID, workItemId: item.id, role: binding.role };

    await engine.runFailed(card, { code: 'run_failed', attempt: 1, terminal: false, decisionId: 'decision-1' });
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'running',
      deadlineAt: expect.any(Number),
      phase: 'planning',
      probes: 0,
      attempts: 1,
    });

    // The run that ran again ended without an outcome: probing keeps the attempts counted.
    await engine.runEnded({ ...binding, runEnd: 'run-2' }, engine);
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({
      state: 'probing',
      deadlineAt: expect.any(Number),
      attempts: 1,
    });

    await engine.runFailed(card, { code: 'run_failed', attempt: 2, terminal: true, decisionId: 'decision-1' });
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'needs_attention',
      phase: 'planning',
      probes: 1,
      attempts: 2,
      failure: 'run_failed',
      reason: 'Agent run ended in error',
    });
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['planning']);
    // The failure's code and label are all the run keeps of it.
    const stored = JSON.stringify(await mastra.getWorkflow('factory-board').getWorkflowRunById(boardRunId(item.id)));
    expect(stored).not.toContain('user-1');
    expect(stored).not.toContain(ORG);
  });

  it("flags the card on a board rule's refusal with the refusal's wording", async () => {
    const { engine, item, binding } = await setup();
    const card = { orgId: ORG, factoryProjectId: PROJECT_ID, workItemId: item.id, role: binding.role };

    await engine.runFailed(card, { code: 'forbidden', attempt: 1, terminal: true, decisionId: 'decision-1' });

    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({
      state: 'needs_attention',
      attempts: 1,
      failure: 'forbidden',
      reason: "A board rule refused the run's move: the board refused the move",
    });
  });

  it('gives a running or probing card a deadline, keeps it while the card stays so, and drops it otherwise', async () => {
    const { storage, engine, item, binding } = await setup({ deadlines: { runningMs: 60_000, probingMs: 5_000 } });
    const card = { orgId: ORG, factoryProjectId: PROJECT_ID, workItemId: item.id, role: binding.role };
    const deadline = async () => (await engine.describe({ workItemId: item.id }))?.deadlineAt;
    const within = async (ms: number, ask: () => Promise<unknown>) => {
      const from = Date.now();
      await ask();
      const at = await deadline();
      expect(at).toBeGreaterThanOrEqual(from + ms);
      expect(at).toBeLessThanOrEqual(Date.now() + ms);
      return at;
    };

    const running = await within(60_000, () =>
      engine.runFailed(card, { code: 'run_failed', attempt: 1, terminal: false, decisionId: 'decision-1' }),
    );
    // A retry of the same phase run is the same stretch of running.
    await engine.runFailed(card, { code: 'run_failed', attempt: 2, terminal: false, decisionId: 'decision-1' });
    await expect(deadline()).resolves.toBe(running);

    await within(5_000, () => engine.runEnded({ ...binding, runEnd: 'run-1' }, engine));
    await engine.runPaused(binding);
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({ state: 'awaiting_approval' });
    await expect(deadline()).resolves.toBeUndefined();

    await engine.runEnded({ ...binding, runEnd: 'run-2' }, engine);
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({ state: 'needs_attention' });
    await expect(deadline()).resolves.toBeUndefined();

    // Start runs the phase again: a new stretch of running with a deadline of its own.
    await within(60_000, async () =>
      engine.requestMove({ ...(await personMove(storage, item.id, 'planning', 'start-1')()), reenter: true }),
    );
    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')());
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({ state: 'resting' });
    await expect(deadline()).resolves.toBeUndefined();
  });

  it('gives a running card six hours and a probing card half an hour by default', async () => {
    const { engine, item, binding } = await setup();
    const from = Date.now();
    await engine.runEnded({ ...binding, runEnd: 'run-1' }, engine);
    expect((await engine.describe({ workItemId: item.id }))?.deadlineAt).toBeGreaterThanOrEqual(from + 30 * 60_000);
    expect((await engine.describe({ workItemId: item.id }))?.deadlineAt).toBeLessThanOrEqual(Date.now() + 30 * 60_000);

    await engine.runFailed(
      { orgId: ORG, factoryProjectId: PROJECT_ID, workItemId: item.id, role: binding.role },
      { code: 'run_failed', attempt: 1, terminal: false, decisionId: 'decision-1' },
    );
    expect((await engine.describe({ workItemId: item.id }))?.deadlineAt).toBeGreaterThanOrEqual(from + 6 * 3_600_000);
  });

  /** Runs on the card's sessions as a sweep finds them: ended, or still going and stoppable or not. */
  function sweptRuns(state: { inFlight: boolean; stops?: boolean }) {
    const stopped: ({ userId: string } | undefined)[] = [];
    const runs: FactoryCardRuns = {
      inFlight: async () => state.inFlight,
      stop: async (_card, by) => {
        stopped.push(by);
        return state.stops ?? false;
      },
    };
    return { runs, stopped };
  }
  const HOUR = 3_600_000;

  it('probes a running card whose run ended unseen once its deadline passed, and flags it once the probe is overdue', async () => {
    const { runs } = sweptRuns({ inFlight: false });
    const { storage, engine, item, binding } = await setup({ runs });
    const card = { orgId: ORG, factoryProjectId: PROJECT_ID, workItemId: item.id, role: binding.role };
    await engine.runFailed(card, { code: 'run_failed', attempt: 1, terminal: false, decisionId: 'decision-1' });

    // Not due yet: nothing changes.
    await engine.sweep(Date.now() + HOUR, engine);
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({ state: 'running', probes: 0 });

    await engine.sweep(Date.now() + 7 * HOUR, engine);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'probing',
      deadlineAt: expect.any(Number),
      phase: 'planning',
      probes: 1,
      attempts: 1,
    });

    await engine.sweep(Date.now() + 7 * HOUR, engine);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'needs_attention',
      phase: 'planning',
      probes: 2,
      attempts: 1,
      reason: "The agent's run ended twice without reporting how the phase ended.",
    });
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['planning']);
  });

  it('moves a running card past its deadline by the outcome its agent reported, through the engine Factory holds', async () => {
    const { runs } = sweptRuns({ inFlight: false });
    const { storage, engine, item, binding } = await setup({ runs });
    await engine.runFailed(
      { orgId: ORG, factoryProjectId: PROJECT_ID, workItemId: item.id, role: binding.role },
      { code: 'run_failed', attempt: 1, terminal: false, decisionId: 'decision-1' },
    );
    // The agent reported the phase's end, but nobody heard its run end.
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
    const held: Pick<FactoryBoardEngine, 'requestMove'> = {
      requestMove: request => {
        seen.push(request.stage);
        return engine.requestMove(request);
      },
    };

    await engine.sweep(Date.now() + 7 * HOUR, held);

    expect(seen).toEqual(['execute']);
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['execute']);
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({
      state: 'running',
      phase: 'execute',
      lastOutcome: 'advance',
    });
  });

  it('stops a run still going past its deadline and flags the card as overdue, or looks again when the run is out of reach', async () => {
    const going = { inFlight: true, stops: false };
    const { runs, stopped } = sweptRuns(going);
    const { engine, mastra, item, binding } = await setup({ runs });
    await engine.runFailed(
      { orgId: ORG, factoryProjectId: PROJECT_ID, workItemId: item.id, role: binding.role },
      { code: 'run_failed', attempt: 1, terminal: false, decisionId: 'decision-1' },
    );
    const first = (await engine.describe({ workItemId: item.id }))!.deadlineAt!;

    // Another process holds the run: its own watch gives it up, so the card is looked at later.
    await engine.sweep(Date.now() + 7 * HOUR, engine);
    const later = await engine.describe({ workItemId: item.id });
    expect(later).toMatchObject({ state: 'running', probes: 0 });
    expect(later!.deadlineAt).toBeGreaterThan(Date.now() + 29 * 60_000);
    expect(later!.deadlineAt).toBeLessThan(first);

    going.stops = true;
    await engine.sweep(Date.now() + 7 * HOUR, engine);
    // Stopped by Factory itself, for no person.
    expect(stopped).toEqual([undefined, undefined]);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'needs_attention',
      phase: 'planning',
      probes: 0,
      attempts: 1,
      failure: 'run_overdue',
      reason: 'Agent run is overdue',
    });
    const run = await mastra.getWorkflow('factory-board').getWorkflowRunById(boardRunId(item.id));
    expect(JSON.stringify(run)).not.toContain('user-1');
    expect(JSON.stringify(run)).not.toContain(ORG);
  });

  it('gives a probe as long as a phase run, and leaves a run the dispatcher still has to start or take over to it', async () => {
    const going = { inFlight: true, stops: true };
    const { runs, stopped } = sweptRuns(going);
    const { storage, engine, item, binding } = await setup({ runs });
    await engine.runEnded({ ...binding, runEnd: 'run-1' }, engine);

    // The probe is the phase run once more: still going past half an hour, it is left to run.
    await engine.sweep(Date.now() + HOUR, engine);
    const probing = await engine.describe({ workItemId: item.id });
    expect(probing).toMatchObject({ state: 'probing', probes: 1 });
    expect(probing!.deadlineAt).toBeGreaterThan(Date.now() + 5 * HOUR);
    expect(stopped).toEqual([]);

    // Its run waits for its turn (or for another worker to take over the one whose watch died).
    going.inFlight = false;
    const card = (await storage.get({ orgId: ORG, id: item.id }))!;
    await storage.commitRuleEvaluation({
      orgId: ORG,
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      ingress: { identity: 'rule-1' },
      expectedRevision: card.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [{ type: 'invokeSkill', role: 'work', skillName: 'factory-plan', idempotencyKey: 'rule-1' }],
      causalChain: [],
      now: new Date(),
    });
    await engine.sweep(Date.now() + 7 * HOUR, engine);
    const waiting = await engine.describe({ workItemId: item.id });
    expect(waiting).toMatchObject({ state: 'probing', probes: 1 });
    expect(waiting!.deadlineAt).toBeLessThan(probing!.deadlineAt!);
  });

  it('acts on nothing for a deadline the card has since moved past', async () => {
    const { runs } = sweptRuns({ inFlight: false });
    const { engine, item, binding } = await setup({ runs });
    const card = { orgId: ORG, factoryProjectId: PROJECT_ID, workItemId: item.id, role: binding.role };
    await engine.runEnded({ ...binding, runEnd: 'run-1' }, engine);
    // What a sweep read while the card was probing, before the next attempt ran.
    const read = await engine.workflow.listWorkflowRuns({ status: 'suspended' });
    await engine.runFailed(card, { code: 'run_failed', attempt: 1, terminal: false, decisionId: 'decision-1' });
    const running = await engine.describe({ workItemId: item.id });
    expect(running).toMatchObject({ state: 'running', probes: 1 });

    const list = vi.spyOn(engine.workflow, 'listWorkflowRuns').mockResolvedValueOnce(read);
    await engine.sweep(Date.now() + 7 * HOUR, engine);

    expect(list).toHaveBeenCalled();
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual(running);
  });

  it('counts one expiry once when every process sweeps it', async () => {
    const { runs } = sweptRuns({ inFlight: false });
    const { storage, engine, runsUrl, item, binding } = await setup({ runs });
    const other = replica(storage, runsUrl, undefined, runs).engine;
    await engine.runFailed(
      { orgId: ORG, factoryProjectId: PROJECT_ID, workItemId: item.id, role: binding.role },
      { code: 'run_failed', attempt: 1, terminal: false, decisionId: 'decision-1' },
    );

    const now = Date.now() + 7 * HOUR;
    await Promise.all([engine.sweep(now, engine), other.sweep(now, other), engine.sweep(now, engine)]);

    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({ state: 'probing', probes: 1 });
  });

  it('counts a failed attempt once, however many times it is told', async () => {
    const { engine, item, binding } = await setup();
    const card = { orgId: ORG, factoryProjectId: PROJECT_ID, workItemId: item.id, role: binding.role };
    await engine.runFailed(card, { code: 'run_failed', attempt: 1, terminal: false, decisionId: 'decision-1' });
    await engine.runEnded({ ...binding, runEnd: 'run-2' }, engine);
    const probing = await engine.describe({ workItemId: item.id });

    await engine.runFailed(card, { code: 'run_failed', attempt: 1, terminal: false, decisionId: 'decision-1' });

    expect(probing).toMatchObject({ state: 'probing', deadlineAt: expect.any(Number), attempts: 1 });
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual(probing);
  });

  it("starts the attempt count over in the card's next phase, and counts nothing for a session that doesn't work it", async () => {
    const { storage, engine, item, binding } = await setup();
    const card = { orgId: ORG, factoryProjectId: PROJECT_ID, workItemId: item.id, role: binding.role };
    await engine.runFailed(card, { code: 'run_failed', attempt: 2, terminal: false, decisionId: 'decision-1' });

    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')());
    const byRule = await personMove(storage, item.id, 'planning', 'rule-1')();
    await engine.requestMove({
      ...byRule,
      actor: { type: 'system', id: 'rule' },
      ingress: { type: 'rule', identity: 'rule-1' },
    });
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'awaiting_start',
      phase: 'planning',
      probes: 0,
    });

    const other = { ...card, role: 'review' };
    await engine.runFailed(other, { code: 'run_failed', attempt: 1, terminal: true, decisionId: 'decision-2' });
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'awaiting_start',
      phase: 'planning',
      probes: 0,
    });
  });

  it('leaves a stopped card in its phase needing attention, and a card no run works as it was', async () => {
    const { storage, engine, mastra, item, binding } = await setup();
    const seat = { orgId: ORG, factoryProjectId: PROJECT_ID, workItemId: item.id, role: binding.role };
    // Nothing recorded working the phase yet: a Stop of the session flags nothing.
    await engine.runStopped(seat);
    await expect(engine.describe({ workItemId: item.id })).resolves.toBeUndefined();

    await engine.runFailed(seat, { code: 'run_failed', attempt: 1, terminal: false, decisionId: 'decision-1' });
    // A session working another role's phase doesn't stop this one.
    await engine.runStopped({ ...seat, role: 'review' });
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({
      state: 'running',
      deadlineAt: expect.any(Number),
    });

    await engine.runStopped(seat);
    await engine.runStopped(seat);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'needs_attention',
      phase: 'planning',
      probes: 0,
      attempts: 1,
      reason: 'Stopped by a person.',
    });
    expect((await storage.get({ orgId: ORG, id: item.id }))!.stages).toEqual(['planning']);
    const stored = JSON.stringify(await mastra.getWorkflow('factory-board').getWorkflowRunById(boardRunId(item.id)));
    expect(stored).not.toContain('user-1');
    expect(stored).not.toContain(ORG);

    // Start enters the phase again, with a go-ahead: its run is queued, and the card is running.
    await engine.requestMove({ ...(await personMove(storage, item.id, 'planning', 'start-1')()), reenter: true });
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'running',
      deadlineAt: expect.any(Number),
      phase: 'planning',
      probes: 0,
    });
  });

  it('counts a run end once, however many times it is told', async () => {
    const { engine, item, binding } = await setup();

    // The dispatcher watching the run and the session itself both tell of the one end.
    const told = await Promise.all([
      engine.runEnded({ ...binding, runEnd: 'run-1' }, engine),
      engine.runEnded({ ...binding, runEnd: 'run-1' }, engine),
    ]);
    await engine.runEnded({ ...binding, runEnd: 'run-1' }, engine);

    expect(told).toEqual([false, false]);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'probing',
      deadlineAt: expect.any(Number),
      phase: 'planning',
      probes: 1,
    });
  });

  it('counts one run end once when two workers tell of it, each from its own session object', async () => {
    const { engine, item, binding } = await setup();
    const openRuns = (await createFactoryStorageForTests()).openRuns;
    const run = {
      kickoffId: 'decision-1',
      bindingId: binding.id,
      role: binding.role,
      startedBy: 'user-1',
      orgId: ORG,
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      sessionId: 'session-1',
      threadId: 'thread-1',
      branch: 'factory/item',
    };
    await openRuns.open(run);
    // Each worker holds its own object for the card's session; both read the one ledger.
    const worker = () => {
      const listeners = new Set<(event: AgentControllerEvent) => void>();
      const session = {
        subscribe: (listener: (event: AgentControllerEvent) => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
      const told: Promise<boolean>[] = [];
      observeSessionPhaseOutcome(session, {
        binding: async () => binding,
        boardEngine: () => ({
          requestMove: request => engine.requestMove(request),
          runEnded: (ended, held) => {
            const answer = engine.runEnded(ended, held);
            told.push(answer);
            return answer;
          },
        }),
        openRun: async () => (await openRuns.listRunning('thread-1')).at(-1)?.kickoffId,
      });
      const end = () => listeners.forEach(listener => listener({ type: 'agent_end', reason: 'complete' }));
      return { end, told };
    };
    const ranIt = worker();
    worker();

    // The run ends on one worker. The other worker's dispatcher reads that end from the ledger and
    // tells of it by the run's kickoff id; its own session object never saw a run end.
    ranIt.end();
    await vi.waitFor(() => expect(ranIt.told).toHaveLength(1));
    await openRuns.end(run.kickoffId, { reason: 'complete', endedAt: Date.now() });
    await openRuns.close(run, Date.now());
    await expect(Promise.all(ranIt.told)).resolves.toEqual([false]);
    await expect(engine.runEnded({ ...binding, runEnd: run.kickoffId }, engine)).resolves.toBe(false);

    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'probing',
      deadlineAt: expect.any(Number),
      phase: 'planning',
      probes: 1,
    });
  });

  it("asks for no second run of a phase that doesn't name how it ends, since the dispatcher runs none", async () => {
    const { storage, engine, item, binding } = await setup();
    // The Work board's review phase runs a skill, with neither a goal nor an exit tool.
    await storage.update({ orgId: ORG, id: item.id, userId: 'user-1', patch: { stages: ['pr-review'] } });
    const review = { ...binding, role: 'review' };

    for (const runEnd of ['run-1', 'run-2', 'run-3']) {
      await expect(engine.runEnded({ ...review, runEnd }, engine)).resolves.toBe(false);
      await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
        state: 'awaiting_start',
        phase: 'pr-review',
        probes: 0,
      });
    }
  });

  it('keeps the outcome that ended the last phase while it probes the next one', async () => {
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
    await expect(engine.runEnded({ ...binding, runEnd: 'run-1' }, engine)).resolves.toBe(true);

    await expect(engine.runEnded({ ...binding, runEnd: 'run-2' }, engine)).resolves.toBe(false);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'probing',
      deadlineAt: expect.any(Number),
      phase: 'execute',
      probes: 1,
      lastOutcome: 'advance',
    });
    await expect(engine.runEnded({ ...binding, runEnd: 'run-3' }, engine)).resolves.toBe(false);
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({
      state: 'needs_attention',
      probes: 2,
      lastOutcome: 'advance',
    });
  });

  it('records no approval wait on the next phase when the card moved on before its run heard of the wait', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const dir = mkdtempSync(join(tmpdir(), 'factory-board-runs-'));
    onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
    const held = Promise.withResolvers<void>();
    const { engine } = replica(storage, `file:${join(dir, 'runs.db')}`, () => held.promise);
    const { item, binding } = await storage.prepareRunStart({
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
    await storage.update({ orgId: ORG, id: item.id, userId: 'user-1', patch: { stages: ['planning'] } });
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

    // Planning's approved plan is moving the card to Building, which the same role works, when
    // the wait Planning's session asked for reaches the card's run.
    const moved = engine.runEnded({ ...binding, runEnd: 'run-1' }, engine);
    await new Promise(resolve => setImmediate(resolve));
    const paused = engine.runPaused(binding);
    await new Promise(resolve => setTimeout(resolve, 50));
    held.resolve();
    await expect(moved).resolves.toBe(true);
    await paused;

    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'running',
      deadlineAt: expect.any(Number),
      phase: 'execute',
      probes: 0,
      lastOutcome: 'advance',
    });
  });

  it("records no approval wait on another board's phase of the same name when the card moved there first", async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const dir = mkdtempSync(join(tmpdir(), 'factory-board-runs-'));
    onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
    // A second board whose Planning the same role works, as Work's does.
    const second = defineBoard({
      id: 'second',
      name: 'Second',
      initialPhase: 'intake',
      phases: {
        intake: { name: 'Intake', kind: 'resting', nextPhases: ['planning'] },
        planning: {
          name: 'Planning',
          kind: 'working',
          runner: { skill: 'factory-plan', context: 'work' },
          nextPhases: ['done'],
        },
        done: { name: 'Done', kind: 'terminal' },
      },
    });
    const boards = createBoardRegistry({ boards: [second] });
    const transitionService = new FactoryTransitionService({ storage, configVersion: 'rules-v1', boards });
    let hold: (() => void) | undefined;
    const held = new Promise<void>(resolve => {
      hold = resolve;
    });
    const engine = new WorkflowBoardEngine({
      transitionService: {
        transition: async request => {
          await held;
          return transitionService.transition(request);
        },
      },
      workItems: storage,
      boards,
    });
    const mastra = new Mastra({
      storage: new LibSQLStore({ id: `board-runs-${randomUUID()}`, url: `file:${join(dir, 'runs.db')}` }),
      workflows: engine.workflows,
      logger: false,
    });
    onTestFinished(() => mastra.shutdown().catch(() => undefined));
    const { item, binding } = await storage.prepareRunStart({
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
    await storage.update({ orgId: ORG, id: item.id, userId: 'user-1', patch: { stages: ['planning'] } });

    // A person is moving the card to the second board when the wait Work's Planning session
    // asked for reaches the card's run.
    const move = await personMove(storage, item.id, 'planning', 'drag-1')();
    const moved = engine.requestMove({ ...move, board: 'second' });
    await new Promise(resolve => setImmediate(resolve));
    const paused = engine.runPaused(binding);
    await new Promise(resolve => setTimeout(resolve, 50));
    hold?.();
    await expect(moved).resolves.toMatchObject({ status: 'accepted' });
    await paused;

    const described = await engine.describe({ workItemId: item.id });
    expect(described).toMatchObject({ phase: 'planning', probes: 0 });
    expect(described?.state).not.toBe('awaiting_approval');
  });

  it("starts the count over in the card's next phase, and counts nothing for a session that doesn't work it", async () => {
    const { storage, engine, item, binding } = await setup();
    await engine.runEnded({ ...binding, runEnd: 'run-1' }, engine);

    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')());
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'resting',
      phase: 'intake',
      probes: 0,
    });
    // A chat with the card's session while it rests ends runs too.
    await expect(engine.runEnded({ ...binding, runEnd: 'run-2' }, engine)).resolves.toBe(false);
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({ state: 'resting', probes: 0 });

    const byRule = await personMove(storage, item.id, 'planning', 'rule-1')();
    await engine.requestMove({
      ...byRule,
      actor: { type: 'system', id: 'rule' },
      ingress: { type: 'rule', identity: 'rule-1' },
    });
    await expect(engine.runEnded({ ...binding, role: 'review', runEnd: 'run-3' }, engine)).resolves.toBe(false);
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({
      state: 'awaiting_start',
      probes: 0,
    });
    await engine.runEnded({ ...binding, runEnd: 'run-4' }, engine);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'probing',
      deadlineAt: expect.any(Number),
      phase: 'planning',
      probes: 1,
    });
  });

  it("leaves the card awaiting approval while its phase's session waits on a person, keeping its probe count", async () => {
    const { storage, engine, item, binding } = await setup();
    await engine.runEnded({ ...binding, runEnd: 'run-1' }, engine);

    await engine.runPaused(binding);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'awaiting_approval',
      phase: 'planning',
      probes: 1,
    });

    // The approved plan ends the phase, and the resumed run's end moves the card.
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
    await expect(engine.runEnded({ ...binding, runEnd: 'run-2' }, engine)).resolves.toBe(true);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'running',
      deadlineAt: expect.any(Number),
      phase: 'execute',
      probes: 0,
      lastOutcome: 'advance',
    });
  });

  it("records no approval wait for a session that doesn't work the card's phase", async () => {
    const { storage, engine, item, binding } = await setup();

    await engine.runPaused({ ...binding, role: 'review' });
    await expect(engine.describe({ workItemId: item.id })).resolves.toBeUndefined();

    await engine.requestMove(await personMove(storage, item.id, 'intake', 'drag-1')());
    await engine.runPaused(binding);
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'resting',
      phase: 'intake',
      probes: 0,
    });
  });

  it('counts nothing against the next phase when the run end that moved the card there is told again', async () => {
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

    await expect(engine.runEnded({ ...binding, runEnd: 'run-1' }, engine)).resolves.toBe(true);
    await expect(engine.runEnded({ ...binding, runEnd: 'run-1' }, engine)).resolves.toBe(false);

    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'running',
      deadlineAt: expect.any(Number),
      phase: 'execute',
      probes: 0,
      lastOutcome: 'advance',
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
    // What the run recorded the card doing is all it holds, and the forged resumes left it alone.
    await expect(engine.describe({ workItemId: item.id })).resolves.toEqual({
      state: 'resting',
      phase: 'intake',
      probes: 0,
    });
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
