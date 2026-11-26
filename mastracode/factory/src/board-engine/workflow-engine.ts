import { isRunFenceConflictError, runOutsideRunFenceScope } from '@mastra/core/storage';

import { phaseMayStartRun } from '../boards/busy-card.js';
import { boardForWorkItem } from '../boards/index.js';
import { startsInAutoPhase } from '../boards/phase-automation.js';
import { pendingPhaseOutcome } from '../boards/phase-outcomes.js';
import { toBoardSource } from '../boards/project-boards.js';
import { moveCardToBoard } from '../boards/relocate.js';
import { applyPhaseOutcome } from '../rules/phase-outcome-move.js';
import type { FactoryTransitionRequest } from '../rules/transition-service.js';
import type { FactoryTransitionResult } from '../rules/types.js';
import {
  boardRunId,
  APPLIED_MOVES,
  COUNTED_RUN_ENDS,
  createFactoryBoardWorkflow,
  FACTORY_BOARD_WORKFLOW_ID,
} from './board-workflow.js';
import type { FactoryBoardWorkflow, FactoryCardRunRecord, FactoryCardRunState } from './board-workflow.js';
import type {
  FactoryBoardEngine,
  FactoryBoardEngineContext,
  FactoryBoardEngineFactory,
  FactoryCardPlacement,
  FactoryCardPlacementResult,
  FactoryRunEndedBinding,
} from './engine.js';

/**
 * How long an input waits for a card's run that another process is driving. Longer than a
 * transition can take (its hooks run for up to 30s); past it, the run is restarted if no live
 * process holds its lease.
 */
const RUN_BUSY_DEADLINE_MS = 60_000;
const RUN_BUSY_MAX_WAIT_MS = 1_000;
/** A run in one of these took its last input; the card's next input starts it over. */
const ENDED_RUN_STATUSES = new Set(['success', 'failed', 'canceled', 'bailed', 'tripwire']);
/** Errors from `resume()` when another caller resumed the run first. */
const RUN_TAKEN_ERROR_IDS = new Set(['WORKFLOW_RUN_NOT_SUSPENDED', 'WORKFLOW_RESUME_ALREADY_CLAIMED']);

/** How long a person's move waits for the run it stopped to end, before it goes ahead regardless. */
const INTERRUPT_WAIT_MS = 120_000;
/** What a card that needs attention tells the person looking at it. */
const NO_OUTCOME_REASON = "The agent's run ended twice without reporting how the phase ended.";

/** An input waiting for the card's run to apply it, and what applying it gave. */
type PendingInput =
  | {
      request: FactoryTransitionRequest;
      answer?: { result: FactoryTransitionResult } | { error: unknown };
    }
  | {
      runEnded: FactoryRunEndedBinding;
      /** Whether the card's phase holds an outcome for the engine to move it by. */
      answer?: { outcome: boolean } | { error: unknown };
    }
  | {
      runPaused: FactoryRunEndedBinding;
      /** The phase the card was in when the session stopped for its answer. */
      phase: string;
      answer?: { paused: true } | { error: unknown };
    };

type CardRef = Pick<FactoryTransitionRequest, 'workItemId'>;

/** Whether the record was made in this phase of this board. */
function sameVisit(previous: FactoryCardRunRecord, board: string, phase: string): boolean {
  return previous.phase === phase && previous.board === board;
}

/** What the record keeps whatever the card does next: the last outcome, and the inputs already heard. */
function carried(previous: FactoryCardRunRecord): Partial<FactoryCardRunRecord> {
  return {
    ...(previous.lastOutcome ? { lastOutcome: previous.lastOutcome } : {}),
    ...(previous.countedRunEnds ? { countedRunEnds: previous.countedRunEnds } : {}),
    ...(previous.appliedMoves ? { appliedMoves: previous.appliedMoves } : {}),
  };
}

/**
 * A board engine where each card has one `factory-board` workflow run that applies everything
 * asked of the card, one input at a time: a move request, and the end of a run of the card's
 * session. The run checks and commits each move through the transition service, so every board
 * check, hook and phase start stays as it is.
 *
 * A card's inputs wait for the one before them, so nothing a move runs may wait on another move
 * of the same card; work it starts in the background, like the phase's session, can ask freely.
 *
 * Its workflow must be registered with the host's Mastra (`MastraFactory` does this), which
 * gives the runs their storage. A card's run starts on the first input asked of it.
 */
export class WorkflowBoardEngine implements FactoryBoardEngine {
  readonly workflow: FactoryBoardWorkflow;
  /** Inputs for one card in this process wait their turn, so a resume never finds the run busy with our own. */
  readonly #queues = new Map<string, Promise<unknown>>();
  /** Moves asked in this process, keyed by the input id their resume carries. */
  readonly #pending = new Map<string, PendingInput>();
  readonly #context: FactoryBoardEngineContext;

  readonly #interruptWaitMs: number;

  constructor(context: FactoryBoardEngineContext, options: { interruptWaitMs?: number } = {}) {
    this.#context = context;
    this.#interruptWaitMs = options.interruptWaitMs ?? INTERRUPT_WAIT_MS;
    this.workflow = createFactoryBoardWorkflow({
      apply: async (inputId, workItemId, state) => {
        const pending = this.#pending.get(inputId);
        if (!pending || pending.answer) return undefined;
        if ('runEnded' in pending) {
          if (pending.runEnded.workItemId !== workItemId) return undefined;
          try {
            const next = await this.#stateAfterRunEnd(pending.runEnded, state);
            pending.answer = { outcome: next?.state === 'running' && next.lastOutcome !== undefined };
            return next;
          } catch (error) {
            pending.answer = { error };
            return undefined;
          }
        }
        if ('runPaused' in pending) {
          if (pending.runPaused.workItemId !== workItemId) return undefined;
          try {
            const next = await this.#stateAfterRunPause(pending.runPaused, pending.phase, state);
            pending.answer = { paused: true };
            return next;
          } catch (error) {
            pending.answer = { error };
            return undefined;
          }
        }
        if (pending.request.workItemId !== workItemId) return undefined;
        try {
          const result = await context.transitionService.transition(pending.request);
          pending.answer = { result };
          return await this.#stateAfterMove(pending.request, result, state);
        } catch (error) {
          // A failed move is the caller's to report; the card's run keeps waiting for the next one.
          pending.answer ??= { error };
          return undefined;
        }
      },
    });
  }

  /** The workflows the host registers with Mastra. */
  get workflows(): Record<string, FactoryBoardWorkflow> {
    return { [FACTORY_BOARD_WORKFLOW_ID]: this.workflow };
  }

  async requestMove({
    interruptedRun: _claimed,
    ...asked
  }: FactoryTransitionRequest): Promise<FactoryTransitionResult> {
    // Only a run this engine stopped itself lets a person's move past the busy card.
    const request = (await this.#interrupts(asked)) ? { ...asked, interruptedRun: true as const } : asked;
    const pending = { request } satisfies PendingInput as Extract<PendingInput, { request: unknown }>;
    await this.#ask(request, pending);
    if (!pending.answer) throw new Error("The card's board run did not apply the move.");
    if ('error' in pending.answer) throw pending.answer.error;
    return pending.answer.result;
  }

  /** Filing a card elsewhere runs no phase and records no transition, so it needs no run. */
  requestPlacement(placement: FactoryCardPlacement): Promise<FactoryCardPlacementResult> {
    return moveCardToBoard(placement);
  }

  /**
   * Tells the card's run that a run of its session ended. With an outcome on the card's phase, the
   * card moves by it: the move is requested through the engine Factory holds once the card's run
   * has answered, so it reaches that run as one more input (and a wrapping engine sees it). With
   * none, the card's run counts the end: the first leaves the card probing, while the dispatcher
   * runs the phase once more, and the second leaves it needing attention.
   */
  async runEnded(binding: FactoryRunEndedBinding, engine: Pick<FactoryBoardEngine, 'requestMove'>): Promise<boolean> {
    const pending = { runEnded: binding } satisfies PendingInput as Extract<PendingInput, { runEnded: unknown }>;
    await this.#ask(binding, pending);
    if (pending.answer && 'error' in pending.answer) throw pending.answer.error;
    if (!pending.answer?.outcome) return false;
    return applyPhaseOutcome(
      { storage: this.#context.workItems, boards: this.#context.boards, boardEngine: engine },
      binding,
    );
  }

  /**
   * Stops the run in flight on a card a person moves into another phase that runs, and waits for it
   * to end: the person's move wins over the run, instead of being refused while the card is busy.
   * A run that hasn't ended in time is given up on, and the move goes ahead. A move the board
   * wouldn't take anyway (another revision, no such edge) stops nothing.
   */
  async #interrupts(request: FactoryTransitionRequest): Promise<boolean> {
    const runs = this.#context.runs;
    if (!runs || request.actor.type !== 'human' || request.ingress.type !== 'human') return false;
    if (request.initialEntry || request.cause === 'run_start') return false;
    if (request.toBoard !== undefined && request.toBoard !== request.board) return false;
    const item = await this.#context.workItems.get({ orgId: request.orgId, id: request.workItemId });
    const from = item?.stages.length === 1 ? item.stages[0] : undefined;
    if (!item || !from || item.revision !== request.expectedRevision || boardForWorkItem(item) !== request.board) {
      return false;
    }
    const board = (await toBoardSource(this.#context.boards).load(request)).get(request.board);
    if (!board || !Object.prototype.hasOwnProperty.call(board.phases, request.stage)) return false;
    if (from === request.stage ? request.reenter !== true : !board.allowsTransition(from, request.stage)) return false;
    if (!phaseMayStartRun(board.phaseKind(request.stage)) || !(await runs.inFlight(request))) return false;
    await runs.stop(request);
    const deadline = Date.now() + this.#interruptWaitMs;
    for (let wait = 50; await runs.inFlight(request); wait = Math.min(wait * 2, 1_000)) {
      if (Date.now() >= deadline) {
        await runs.abandon(request);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, wait));
    }
    return true;
  }

  /**
   * Tells the card's run that its phase's session waits on a person's answer. The card awaits
   * approval until the next input says otherwise: the move an approval makes, or a run end.
   */
  async runPaused(binding: FactoryRunEndedBinding): Promise<void> {
    // The phase the session waits in, read now: by the time the card's run hears of the wait, the
    // card may have moved on to a phase the same role works.
    const item = await this.#context.workItems.get({ orgId: binding.orgId, id: binding.workItemId });
    const phase = item?.stages.length === 1 ? item.stages[0] : undefined;
    if (!phase) return;
    const pending = { runPaused: binding, phase } satisfies PendingInput as Extract<
      PendingInput,
      { runPaused: unknown }
    >;
    await this.#ask(binding, pending);
    if (pending.answer && 'error' in pending.answer) throw pending.answer.error;
  }

  /** What the card's run last recorded the card doing; nothing for a card no input was asked of. */
  async describe(card: CardRef): Promise<FactoryCardRunState | undefined> {
    if (!this.workflow.mastra) return undefined;
    const run = await this.workflow.getWorkflowRunById(boardRunId(card.workItemId), { withNestedWorkflows: false });
    const recorded = (run?.steps?.phase as { payload?: FactoryCardRunRecord } | undefined)?.payload;
    if (!recorded?.state) return undefined;
    const { countedRunEnds: _counted, appliedMoves: _applied, board: _board, ...state } = recorded;
    return state;
  }

  /**
   * What the card is doing once a move was answered, from the phase it sits in now. A working
   * phase is running when the move queued its run with a go-ahead: a person's or an agent's move,
   * a card someone already started, or a phase that starts on its own. Otherwise it waits for one.
   */
  async #stateAfterMove(
    request: FactoryTransitionRequest,
    result: FactoryTransitionResult,
    previous: FactoryCardRunRecord,
  ): Promise<FactoryCardRunRecord | undefined> {
    const item = await this.#context.workItems.get({ orgId: request.orgId, id: request.workItemId });
    const phase = item?.stages[0];
    if (!item || !phase) return undefined;
    const boards = await toBoardSource(this.#context.boards).load(request);
    const board = boardForWorkItem(item);
    const kind = boards.get(board)?.phaseKind(phase);
    if (!kind) return undefined;
    // A request made again is answered with the first one's result, run and all: nothing new
    // was committed or queued, so what the card was doing stands.
    const applied = previous.appliedMoves ?? [];
    if (result.status === 'accepted' && applied.includes(result.transitionId) && previous.state) return previous;
    const run =
      result.status === 'accepted' ? result.decisions.find(decision => decision.type === 'invokeSkill') : undefined;
    // A refused move, or one that left the card where it was, changes nothing the card was doing there.
    if (sameVisit(previous, board, phase) && previous.state && !run) return previous;
    // The outcome that ended the last phase, and the inputs already heard, outlive the move.
    const kept = {
      ...carried(previous),
      ...(result.status === 'accepted'
        ? { appliedMoves: [...applied, result.transitionId].slice(-APPLIED_MOVES) }
        : {}),
    };
    if (kind !== 'working') return { state: kind, phase, board, probes: 0, ...kept };
    // The dispatcher's own rule for a run that starts without a person: never on an outside
    // author's pull request event, however the phase starts.
    const goAhead =
      run !== undefined &&
      run.untrustedPullRequestEvent !== true &&
      (request.actor.type === 'human' ||
        request.actor.type === 'agent' ||
        item.autonomyArmedAt != null ||
        startsInAutoPhase(boards, item, run));
    return { state: goAhead ? 'running' : 'awaiting_start', phase, board, probes: 0, ...kept };
  }

  /**
   * What the card is doing once a run of its session ended. An end told of a phase the session's
   * role doesn't work (a chat on a resting card) changes nothing.
   */
  async #stateAfterRunEnd(
    binding: FactoryRunEndedBinding,
    previous: FactoryCardRunRecord,
  ): Promise<FactoryCardRunRecord | undefined> {
    const item = await this.#context.workItems.get({ orgId: binding.orgId, id: binding.workItemId });
    const phase = item?.stages.length === 1 ? item.stages[0] : undefined;
    if (!item || !phase) return undefined;
    const board = (await toBoardSource(this.#context.boards).load(binding)).get(boardForWorkItem(item));
    if (!board || board.phaseKind(phase) !== 'working') return undefined;
    // A phase the run never saw the card enter starts its count here.
    const at = { phase, board: board.id };
    const probes = sameVisit(previous, board.id, phase) ? (previous.probes ?? 0) : 0;
    const heard = previous.countedRunEnds ?? [];
    const moves = previous.appliedMoves ? { appliedMoves: previous.appliedMoves } : {};
    const counted = {
      ...moves,
      ...(binding.runEnd && !heard.includes(binding.runEnd)
        ? { countedRunEnds: [...heard, binding.runEnd].slice(-COUNTED_RUN_ENDS) }
        : previous.countedRunEnds
          ? { countedRunEnds: previous.countedRunEnds }
          : {}),
    };
    const outcome = pendingPhaseOutcome(board, item);
    if (outcome) return { state: 'running', ...at, probes, lastOutcome: outcome.outcome, ...counted };
    // An end already counted, even on the phase the card has since left, and an end of a session
    // that doesn't work this phase, say nothing about how the phase is going.
    if (binding.runEnd !== undefined && heard.includes(binding.runEnd)) return undefined;
    if (board.roleForPhase(phase) !== binding.role) return undefined;
    const kept = previous.lastOutcome ? { lastOutcome: previous.lastOutcome } : {};
    // Nobody runs a phase again that doesn't name how it ends (a goal or an exit tool): its run
    // just ended, nothing is probed, and its next run waits for a person.
    const definition = board.phases[phase];
    if (definition?.kind !== 'working' || !(definition.runner.goal || definition.exitTool)) {
      return { state: 'awaiting_start', ...at, probes, ...kept, ...counted };
    }
    // Only a teller that runs the phase again asks for a second run; an end nobody follows up (a
    // person's chat turn with the session, or an end the dispatcher lets stand) says nothing about
    // how the phase is going, and stays uncounted so the teller that does follow up is still heard.
    if (binding.runsAgain !== true) return undefined;
    return {
      ...at,
      probes: probes + 1,
      ...kept,
      ...counted,
      ...(probes === 0
        ? { state: 'probing' as const }
        : { state: 'needs_attention' as const, reason: NO_OUTCOME_REASON }),
    };
  }

  /**
   * What the card is doing once a run of its session stopped for a person's answer. A session that
   * doesn't work the card's phase (a chat on a resting card) changes nothing.
   */
  async #stateAfterRunPause(
    binding: FactoryRunEndedBinding,
    pausedIn: string,
    previous: FactoryCardRunRecord,
  ): Promise<FactoryCardRunRecord | undefined> {
    const item = await this.#context.workItems.get({ orgId: binding.orgId, id: binding.workItemId });
    const phase = item?.stages.length === 1 ? item.stages[0] : undefined;
    if (!item || !phase || phase !== pausedIn) return undefined;
    const board = (await toBoardSource(this.#context.boards).load(binding)).get(boardForWorkItem(item));
    if (!board || board.phaseKind(phase) !== 'working' || board.roleForPhase(phase) !== binding.role) return undefined;
    return {
      state: 'awaiting_approval',
      phase,
      board: board.id,
      probes: sameVisit(previous, board.id, phase) ? (previous.probes ?? 0) : 0,
      ...carried(previous),
    };
  }

  /**
   * Ends the run of a card that was deleted. Inputs asked before the delete are answered first
   * (the card is gone, so they move nothing); an input asked after it would start a run that finds
   * no card.
   */
  async cardDeleted(card: CardRef): Promise<void> {
    if (!this.workflow.mastra) return;
    await this.#queued(card, () => this.workflow.deleteWorkflowRunById(boardRunId(card.workItemId)));
  }

  async #ask(card: CardRef, pending: PendingInput): Promise<void> {
    const inputId = crypto.randomUUID();
    this.#pending.set(inputId, pending);
    try {
      await this.#queued(card, () => this.#resume(card, inputId, pending));
    } finally {
      this.#pending.delete(inputId);
    }
  }

  #queued(card: CardRef, work: () => Promise<void>): Promise<void> {
    const previous = this.#queues.get(card.workItemId) ?? Promise.resolve();
    // A run end can be told from work a step of this same run started (the phase's session), which
    // still carries the claim that step held. The input is new work on the run: it claims it afresh.
    const next = previous.catch(() => undefined).then(() => runOutsideRunFenceScope(work));
    this.#queues.set(card.workItemId, next);
    void next
      .catch(() => undefined)
      .finally(() => {
        if (this.#queues.get(card.workItemId) === next) this.#queues.delete(card.workItemId);
      });
    return next;
  }

  async #resume(card: CardRef, inputId: string, pending: PendingInput): Promise<void> {
    if (!this.workflow.mastra) {
      throw new Error('The board workflow is not registered with Mastra, so cards have no runs to move them.');
    }
    const runId = boardRunId(card.workItemId);
    const deadline = Date.now() + RUN_BUSY_DEADLINE_MS;
    for (let wait = 50; ; wait = Math.min(wait * 2, RUN_BUSY_MAX_WAIT_MS)) {
      const stored = await this.workflow.getWorkflowRunById(runId, { withNestedWorkflows: false });
      if (!stored || ENDED_RUN_STATUSES.has(stored.status)) {
        // An ended run keeps nothing the card needs; its next input runs a new one under the same id.
        if (stored) await this.workflow.deleteWorkflowRunById(runId);
        await this.#start(runId);
        continue;
      }
      if (stored.status === 'suspended') {
        const run = await this.workflow.createRun({ runId });
        try {
          const result = await run.resume({ step: 'phase', resumeData: { inputId } });
          // Once the move was applied its answer stands, however the run fared after it.
          if (pending.answer) return;
          if (result.status === 'suspended') throw new Error("The card's board run did not apply its input.");
          // The run this process held ended without taking the input (another process may have
          // replaced it since); read what the card's run is now.
        } catch (error) {
          // Applied, then the run could not be saved: another process replaced it meanwhile. The
          // move committed, and the run holds nothing the card needs.
          if (pending.answer) return;
          // Another caller resumed the run first; wait for it to suspend again.
          if (!RUN_TAKEN_ERROR_IDS.has((error as { id?: unknown } | null)?.id as string)) throw error;
        }
      } else if (Date.now() >= deadline) {
        // A run still busy this long lost its process; restart() refuses while a live process holds its lease.
        await (await this.workflow.createRun({ runId })).restart().catch((error: unknown) => {
          if ((error as { id?: unknown } | null)?.id !== 'WORKFLOW_RESTART_RUN_OWNED') throw error;
        });
      }
      if (Date.now() >= deadline + RUN_BUSY_DEADLINE_MS)
        throw new Error("The card's board run stayed busy; try again.");
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }

  /** Starts the card's run, which waits for its first input; a start another process won is left to it. */
  async #start(runId: string): Promise<void> {
    const run = await this.workflow.createRun({ runId });
    try {
      const result = await run.start({ inputData: {} });
      if (result.status !== 'suspended') {
        throw new Error(`The card's board run ended ${result.status} instead of waiting for its first input.`);
      }
    } catch (error) {
      if (!isRunFenceConflictError(error)) throw error;
    }
  }
}

export const createWorkflowBoardEngine: FactoryBoardEngineFactory = context => new WorkflowBoardEngine(context);
