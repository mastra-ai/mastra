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
      phase: 'execute',
      probes: 0,
      lastOutcome: 'advance',
    });
  });

  it("counts no probe for a run end nobody follows with another run, like a person's chat turn", async () => {
    const { engine, item, binding } = await setup();
    const chat = { ...binding, runsAgain: undefined };
    await engine.runEnded({ ...binding, runEnd: 'run-1' }, engine);
    const probing = { state: 'probing', phase: 'planning', probes: 1 };
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
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({ state: 'probing', probes: 1 });

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
    await expect(engine.describe({ workItemId: item.id })).resolves.toMatchObject({ state: 'running', probes: 0 });
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
      phase: 'execute',
      probes: 0,
      lastOutcome: 'advance',
    });
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
