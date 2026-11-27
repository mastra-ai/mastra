import { isRunFenceConflictError, runOutsideRunFenceScope } from '@mastra/core/storage';

import { phaseMayStartRun } from '../boards/busy-card.js';
import { boardForWorkItem } from '../boards/index.js';
import { startsInAutoPhase } from '../boards/phase-automation.js';
import { pendingPhaseOutcome } from '../boards/phase-outcomes.js';
import { toBoardSource } from '../boards/project-boards.js';
import { moveCardToBoard } from '../boards/relocate.js';
import { applyPhaseOutcome } from '../rules/phase-outcome-move.js';
import { failureLabel } from '../rules/public-failure-reason.js';
import { markRunInterrupted } from '../rules/transition-service.js';
import type { FactoryTransitionRequest } from '../rules/transition-service.js';
import type { FactoryTransitionResult } from '../rules/types.js';
import type { FactoryRunBindingRecord } from '../storage/domains/work-items/base.js';
import {
  boardRunId,
  APPLIED_MOVES,
  COUNTED_FAILURES,
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
  FactoryCardSeat,
  FactoryRunFailure,
  FactorySubmittedMove,
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
/** How long a card may be `running` or `probing` before the sweeper looks at it. */
const RUNNING_DEADLINE_MS = 6 * 60 * 60_000;
const PROBING_DEADLINE_MS = 30 * 60_000;
/** A phase run the dispatcher still has to start, start again, or see end. */
const UNSETTLED_DECISIONS = ['pending', 'leased', 'retry'] as const;
/** How many board runs a sweep reads at a time. */
const SWEEP_PAGE = 100;
/** What a card that needs attention tells the person looking at it. */
const NO_OUTCOME_REASON = "The agent's run ended twice without reporting how the phase ended.";
const STOPPED_REASON = 'Stopped by a person.';
/** What a card is doing while a run works its phase, which a person's Stop ends. */
const RUN_STATES = new Set<FactoryCardRunRecord['state']>(['running', 'probing', 'awaiting_approval']);
const NOT_RUN_AGAIN_REASON =
  "The agent's run ended without reporting how the phase ended, and it will not be run again.";

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
      /** The board and phase the card was in when the session stopped for its answer. */
      board: string;
      phase: string;
      answer?: { paused: true } | { error: unknown };
    }
  | {
      runFailed: FactoryCardSeat;
      failure: FactoryRunFailure;
      answer?: { heard: true } | { error: unknown };
    }
  | {
      runStopped: FactoryCardSeat;
      answer?: { heard: true } | { error: unknown };
    }
  | {
      /** A sweep found the card's record past `deadlineAt`; the card's active seats, newest first. */
      deadline: CardAddress;
      deadlineAt: number;
      bindings: FactoryRunBindingRecord[];
      /** The run end it told the card's run of, when the card holds an outcome to move it by. */
      answer?: { outcome?: FactoryRunEndedBinding } | { error: unknown };
    };

type CardAddress = Pick<FactoryTransitionRequest, 'orgId' | 'factoryProjectId' | 'workItemId'>;

type CardRef = Pick<FactoryTransitionRequest, 'workItemId'>;

/** The record a board run's stored snapshot holds for its card. */
function recordOf(snapshot: unknown): FactoryCardRunRecord | undefined {
  const state = typeof snapshot === 'string' ? (JSON.parse(snapshot) as unknown) : snapshot;
  const phase = (state as { context?: { phase?: { payload?: FactoryCardRunRecord } } } | undefined)?.context?.phase;
  return phase?.payload;
}

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
    ...(previous.countedFailures ? { countedFailures: previous.countedFailures } : {}),
  };
}

/** The failed attempts counted in this visit of the phase; a phase entered anew starts with none. */
function attemptsIn(previous: FactoryCardRunRecord, board: string, phase: string): Partial<FactoryCardRunRecord> {
  return sameVisit(previous, board, phase) && previous.attempts !== undefined ? { attempts: previous.attempts } : {};
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
  readonly #deadlines: { running: number; probing: number };

  constructor(
    context: FactoryBoardEngineContext,
    options: WorkflowBoardEngineOptions & { interruptWaitMs?: number } = {},
  ) {
    this.#context = context;
    this.#interruptWaitMs = options.interruptWaitMs ?? INTERRUPT_WAIT_MS;
    this.#deadlines = {
      running: options.deadlines?.runningMs ?? RUNNING_DEADLINE_MS,
      probing: options.deadlines?.probingMs ?? PROBING_DEADLINE_MS,
    };
    this.workflow = createFactoryBoardWorkflow({
      apply: async (inputId, workItemId, state) => {
        const next = await this.#apply(inputId, workItemId, state);
        return next && this.#withDeadline(state, next);
      },
    });
  }

  /**
   * The record with its deadline: entering `running` or `probing` (a new state, or the same one in
   * a new visit of a phase) starts one, staying keeps it, and any other state has none.
   */
  #withDeadline(previous: FactoryCardRunRecord, next: FactoryCardRunRecord): FactoryCardRunRecord {
    const { deadlineAt: set, ...rest } = next;
    if (next.state !== 'running' && next.state !== 'probing') return rest;
    // An input that sets a deadline of its own (a sweep giving a live run more time) keeps it.
    if (set !== undefined && set !== previous.deadlineAt) return next;
    const stays =
      previous.state === next.state &&
      previous.deadlineAt !== undefined &&
      next.board !== undefined &&
      next.phase !== undefined &&
      sameVisit(previous, next.board, next.phase);
    return {
      ...rest,
      deadlineAt: stays ? previous.deadlineAt : Date.now() + this.#deadlines[next.state],
    };
  }

  async #apply(
    inputId: string,
    workItemId: string,
    state: FactoryCardRunRecord,
  ): Promise<FactoryCardRunRecord | undefined> {
    const context = this.#context;
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
    if ('runFailed' in pending) {
      if (pending.runFailed.workItemId !== workItemId) return undefined;
      try {
        const next = await this.#stateAfterRunFailure(pending.runFailed, pending.failure, state);
        pending.answer = { heard: true };
        return next;
      } catch (error) {
        pending.answer = { error };
        return undefined;
      }
    }
    if ('deadline' in pending) {
      if (pending.deadline.workItemId !== workItemId) return undefined;
      try {
        const answer: { outcome?: FactoryRunEndedBinding } = {};
        const next = await this.#stateAfterDeadline(pending, answer, state);
        pending.answer = answer;
        return next;
      } catch (error) {
        pending.answer = { error };
        return undefined;
      }
    }
    if ('runStopped' in pending) {
      if (pending.runStopped.workItemId !== workItemId) return undefined;
      try {
        const next = await this.#stateAfterRunStop(pending.runStopped, state);
        pending.answer = { heard: true };
        return next;
      } catch (error) {
        pending.answer = { error };
        return undefined;
      }
    }
    if ('runPaused' in pending) {
      if (pending.runPaused.workItemId !== workItemId) return undefined;
      try {
        const next = await this.#stateAfterRunPause(pending.runPaused, pending, state);
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
  }

  /** The workflows the host registers with Mastra. */
  get workflows(): Record<string, FactoryBoardWorkflow> {
    return { [FACTORY_BOARD_WORKFLOW_ID]: this.workflow };
  }

  async requestMove(asked: FactoryTransitionRequest): Promise<FactoryTransitionResult> {
    // A copy, so the mark stays on the request this engine hands the transition service.
    const request = (await this.#interrupts(asked)) ? markRunInterrupted({ ...asked }) : asked;
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
   * Takes on a person's move that looks good from here and answers it later: the move may wait on
   * the card's run being stopped. Anything else is answered on the spot.
   */
  async submitMove(request: FactoryTransitionRequest): Promise<FactorySubmittedMove> {
    if (!(await this.#movable(request))) return { answered: await this.requestMove(request) };
    const settled = this.requestMove(request);
    // Whoever holds `settled` hears of a failure; nobody holding it must not crash the process.
    settled.catch(() => undefined);
    return { inputId: globalThis.crypto.randomUUID(), settled };
  }

  /**
   * Whether a person's move within the card's board passes the checks that need no commit: the
   * card sits in one phase at the revision the person saw, its board allows the move, and the
   * request wasn't answered before (one that was is answered the same again, and moves nothing).
   */
  async #movable(request: FactoryTransitionRequest): Promise<{ stopsRun: boolean; userId: string } | undefined> {
    if (request.actor.type !== 'human' || request.ingress.type !== 'human') return undefined;
    if (request.initialEntry || request.cause === 'run_start') return undefined;
    if (request.toBoard !== undefined && request.toBoard !== request.board) return undefined;
    const item = await this.#context.workItems.get({ orgId: request.orgId, id: request.workItemId });
    const from = item?.stages.length === 1 ? item.stages[0] : undefined;
    if (!item || !from || item.revision !== request.expectedRevision || boardForWorkItem(item) !== request.board) {
      return undefined;
    }
    const board = (await toBoardSource(this.#context.boards).load(request)).get(request.board);
    if (!board || !Object.prototype.hasOwnProperty.call(board.phases, request.stage)) return undefined;
    if (from === request.stage ? request.reenter !== true : !board.allowsTransition(from, request.stage)) {
      return undefined;
    }
    const answered = await this.#context.workItems.getTransitionResultByIngress?.(
      request.orgId,
      request.factoryProjectId,
      request.ingress.identity,
    );
    if (answered) return undefined;
    const kind = board.phaseKind(request.stage);
    // A phase that runs takes the card from the run going now; a terminal one (Cancel) ends it.
    return { stopsRun: phaseMayStartRun(kind) || kind === 'terminal', userId: request.actor.id };
  }

  /**
   * Stops the run in flight on a card a person moves into another phase that runs, and waits for it
   * to end: the person's move wins over the run, instead of being refused while the card is busy.
   * A run that hasn't ended in time keeps its record and its card, and the move is refused as
   * busy, and so is a move by a person who may not drive the run's session. A move the board
   * wouldn't take anyway (another revision, no such edge) or already answered stops nothing.
   * A move into a terminal phase (Cancel) stops the run the same way; one that can't stop it
   * still commits, as it did before, since a terminal phase starts nothing to be busy with.
   */
  async #interrupts(request: FactoryTransitionRequest): Promise<boolean> {
    const runs = this.#context.runs;
    const move = runs ? await this.#movable(request) : undefined;
    if (!runs || !move) return false;
    if (!move.stopsRun || !(await runs.inFlight(request))) return false;
    // A run another process holds, or one on a session the person may not drive, isn't stopped
    // from here, so the move is refused as busy at once instead of after the wait.
    if (!(await runs.stop(request, { userId: move.userId }))) return false;
    const deadline = Date.now() + this.#interruptWaitMs;
    for (let wait = 50; await runs.inFlight(request); wait = Math.min(wait * 2, 1_000)) {
      // Still going: the run keeps its record and its card, and the move is refused as busy.
      if (Date.now() >= deadline) return false;
      await new Promise(resolve => setTimeout(resolve, wait));
    }
    return true;
  }

  /**
   * Tells the card's run that its phase's session waits on a person's answer. The card awaits
   * approval until the next input says otherwise: the move an approval makes, or a run end.
   */
  async runPaused(binding: FactoryRunEndedBinding): Promise<void> {
    // Where the session waits, read now: by the time the card's run hears of the wait, the card
    // may have moved on to a phase the same role works, on this board or another.
    const item = await this.#context.workItems.get({ orgId: binding.orgId, id: binding.workItemId });
    const phase = item?.stages.length === 1 ? item.stages[0] : undefined;
    if (!item || !phase) return;
    const pending = { runPaused: binding, board: boardForWorkItem(item), phase } satisfies PendingInput as Extract<
      PendingInput,
      { runPaused: unknown }
    >;
    await this.#ask(binding, pending);
    if (pending.answer && 'error' in pending.answer) throw pending.answer.error;
  }

  /**
   * Tells the card's run that an attempt at running its phase failed: it counts the attempt, and
   * the last one leaves the card needing attention, with the failure's label as the reason.
   */
  async runFailed(seat: FactoryCardSeat, failure: FactoryRunFailure): Promise<void> {
    const pending = { runFailed: seat, failure } satisfies PendingInput as Extract<
      PendingInput,
      { runFailed: unknown }
    >;
    await this.#ask(seat, pending);
    if (pending.answer && 'error' in pending.answer) throw pending.answer.error;
  }

  /**
   * Tells the card's run that a person stopped its phase's run: the card stays where it is and
   * needs attention until someone starts the phase again. Who stopped it isn't the run's to keep.
   */
  async runStopped(seat: FactoryCardSeat): Promise<void> {
    const pending = { runStopped: seat } satisfies PendingInput as Extract<PendingInput, { runStopped: unknown }>;
    await this.#ask(seat, pending);
    if (pending.answer && 'error' in pending.answer) throw pending.answer.error;
  }

  /** What the card's run last recorded the card doing; nothing for a card no input was asked of. */
  async describe(card: CardRef): Promise<FactoryCardRunState | undefined> {
    if (!this.workflow.mastra) return undefined;
    const run = await this.workflow.getWorkflowRunById(boardRunId(card.workItemId), { withNestedWorkflows: false });
    const recorded = (run?.steps?.phase as { payload?: FactoryCardRunRecord } | undefined)?.payload;
    if (!recorded?.state) return undefined;
    const {
      countedRunEnds: _counted,
      appliedMoves: _applied,
      countedFailures: _failures,
      board: _board,
      ...state
    } = recorded;
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
      ...(previous.countedFailures ? { countedFailures: previous.countedFailures } : {}),
      ...attemptsIn(previous, board.id, phase),
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
    // Only a teller that decides whether the phase is run again says how it is going; an end
    // nobody follows up (a person's chat turn with the session, or an end the dispatcher lets
    // stand) stays uncounted, so the teller that does follow up is still heard.
    if (binding.runsAgain === undefined) return undefined;
    // A second run is the probe. Without one, whatever the count, nothing is working the phase.
    const probed = binding.runsAgain && probes === 0;
    return {
      ...at,
      probes: probes + 1,
      ...kept,
      ...counted,
      ...(probed
        ? { state: 'probing' as const }
        : { state: 'needs_attention' as const, reason: probes === 0 ? NOT_RUN_AGAIN_REASON : NO_OUTCOME_REASON }),
    };
  }

  /**
   * What the card is doing once a run of its session stopped for a person's answer. A session that
   * doesn't work the card's phase (a chat on a resting card) changes nothing.
   */
  async #stateAfterRunPause(
    binding: FactoryRunEndedBinding,
    pausedIn: { board: string; phase: string },
    previous: FactoryCardRunRecord,
  ): Promise<FactoryCardRunRecord | undefined> {
    const item = await this.#context.workItems.get({ orgId: binding.orgId, id: binding.workItemId });
    const phase = item?.stages.length === 1 ? item.stages[0] : undefined;
    if (!item || !phase || phase !== pausedIn.phase || boardForWorkItem(item) !== pausedIn.board) return undefined;
    const board = (await toBoardSource(this.#context.boards).load(binding)).get(boardForWorkItem(item));
    if (!board || board.phaseKind(phase) !== 'working' || board.roleForPhase(phase) !== binding.role) return undefined;
    return {
      state: 'awaiting_approval',
      phase,
      board: board.id,
      probes: sameVisit(previous, board.id, phase) ? (previous.probes ?? 0) : 0,
      ...attemptsIn(previous, board.id, phase),
      ...carried(previous),
    };
  }

  /**
   * What the card is doing once an attempt at running its phase failed. A failure of a session
   * that doesn't work the card's phase, or one already counted, changes nothing.
   */
  async #stateAfterRunFailure(
    card: FactoryCardSeat,
    failure: FactoryRunFailure,
    previous: FactoryCardRunRecord,
  ): Promise<FactoryCardRunRecord | undefined> {
    const item = await this.#context.workItems.get({ orgId: card.orgId, id: card.workItemId });
    const phase = item?.stages.length === 1 ? item.stages[0] : undefined;
    if (!item || !phase) return undefined;
    const board = (await toBoardSource(this.#context.boards).load(card)).get(boardForWorkItem(item));
    if (!board || board.phaseKind(phase) !== 'working' || board.roleForPhase(phase) !== card.role) return undefined;
    const key = `${failure.decisionId}:${failure.attempt}`;
    const heard = previous.countedFailures ?? [];
    if (heard.includes(key)) return undefined;
    return {
      phase,
      board: board.id,
      probes: sameVisit(previous, board.id, phase) ? (previous.probes ?? 0) : 0,
      ...carried(previous),
      countedFailures: [...heard, key].slice(-COUNTED_FAILURES),
      attempts: failure.attempt,
      // Not the last attempt: the dispatcher runs the phase again.
      ...(failure.terminal
        ? { state: 'needs_attention' as const, failure: failure.code, reason: failureLabel(failure.code) }
        : { state: 'running' as const }),
    };
  }

  /**
   * What the card is doing once a person stopped its phase's run. A stop of a session that doesn't
   * work the card's phase, or with no run working it (nothing started, or already flagged), changes
   * nothing.
   */
  async #stateAfterRunStop(
    seat: FactoryCardSeat,
    previous: FactoryCardRunRecord,
  ): Promise<FactoryCardRunRecord | undefined> {
    const item = await this.#context.workItems.get({ orgId: seat.orgId, id: seat.workItemId });
    const phase = item?.stages.length === 1 ? item.stages[0] : undefined;
    if (!item || !phase || !RUN_STATES.has(previous.state)) return undefined;
    const board = (await toBoardSource(this.#context.boards).load(seat)).get(boardForWorkItem(item));
    if (!board || !sameVisit(previous, board.id, phase) || board.roleForPhase(phase) !== seat.role) return undefined;
    return {
      state: 'needs_attention',
      phase,
      board: board.id,
      probes: previous.probes ?? 0,
      ...attemptsIn(previous, board.id, phase),
      ...carried(previous),
      reason: STOPPED_REASON,
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

  /**
   * Answers an input for a card that no longer exists, so no run is started to wait on it forever:
   * the card's session can end a run after the card was deleted.
   */
  /**
   * Looks at every card whose run is past its deadline, as told by `now`: a card still `running`
   * or `probing` whose run's end nobody heard (its process died with the run's watch) is told of
   * that end, so it moves by the outcome its agent reported or is probed and flagged; a run still
   * going past it is stopped, which flags the card. Each card's run checks the deadline it was
   * asked about is still its own, so a sweep in every process acts on one expiry once.
   *
   * Moves go through `engine`, the engine Factory holds, as a run end's move does.
   */
  async sweep(now: number, engine: Pick<FactoryBoardEngine, 'requestMove'> = this): Promise<void> {
    const listBindings = this.#context.workItems.listActiveRunBindings?.bind(this.#context.workItems);
    if (!this.workflow.mastra || !this.#context.runs || !listBindings) return;
    const due = new Map<string, number>();
    for (let page = 0; ; page++) {
      const { runs } = await this.workflow.listWorkflowRuns({ status: 'suspended', perPage: SWEEP_PAGE, page });
      for (const run of runs) {
        const record = recordOf(run.snapshot);
        const pastDue =
          (record?.state === 'running' || record?.state === 'probing') &&
          record.deadlineAt !== undefined &&
          record.deadlineAt <= now;
        if (pastDue && run.runId.startsWith(`${FACTORY_BOARD_WORKFLOW_ID}:`)) {
          due.set(run.runId.slice(FACTORY_BOARD_WORKFLOW_ID.length + 1), record.deadlineAt!);
        }
      }
      if (runs.length < SWEEP_PAGE) break;
    }
    if (due.size === 0) return;
    const seats = (await listBindings())
      .filter(binding => due.has(binding.workItemId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    for (const [workItemId, deadlineAt] of due) {
      const bindings = seats.filter(binding => binding.workItemId === workItemId);
      // A card no session is bound to has no run to look for, and its record names no organization.
      if (!bindings[0]) continue;
      const { orgId, factoryProjectId } = bindings[0];
      const pending: Extract<PendingInput, { deadline: unknown }> = {
        deadline: { orgId, factoryProjectId, workItemId },
        deadlineAt,
        bindings,
      };
      try {
        await this.#ask(pending.deadline, pending);
        const { answer } = pending;
        if (answer && 'error' in answer) throw answer.error;
        if (answer?.outcome) {
          await applyPhaseOutcome(
            { storage: this.#context.workItems, boards: this.#context.boards, boardEngine: engine },
            answer.outcome,
          );
        }
      } catch (error) {
        // One card's trouble doesn't keep the sweep from the others; the next sweep asks again.
        console.warn(`[factory] sweeping card ${workItemId} past its deadline failed`, error);
      }
    }
  }

  /**
   * What a card past its deadline is doing: nothing changes unless the deadline is still the one
   * the card's record holds. A run still going is stopped and the card flagged as overdue, or, when
   * the run is another process's to stop, looked at again later; a run that ended unseen is told
   * as a run end, which is a probe of a `running` card and the last straw for a `probing` one.
   */
  async #stateAfterDeadline(
    pending: Extract<PendingInput, { deadline: unknown }>,
    answer: { outcome?: FactoryRunEndedBinding },
    previous: FactoryCardRunRecord,
  ): Promise<FactoryCardRunRecord | undefined> {
    const card = pending.deadline;
    const runs = this.#context.runs;
    if (previous.deadlineAt !== pending.deadlineAt || !RUN_STATES.has(previous.state) || !runs) return undefined;
    if (!previous.phase || !previous.board) return undefined;
    const board = (await toBoardSource(this.#context.boards).load(card)).get(previous.board);
    const role = board?.roleForPhase(previous.phase);
    const binding = pending.bindings.find(seat => seat.role === role);
    if (!binding) return undefined;
    const later = { ...previous, deadlineAt: Date.now() + this.#deadlines.probing };
    if (await runs.inFlight(card)) {
      // A probe is the phase run once more, and gets as long as any run of the phase.
      if (previous.state === 'probing') return { ...previous, deadlineAt: Date.now() + this.#deadlines.running };
      const { deadlineAt: _expired, ...kept } = previous;
      if (await runs.stop(card)) {
        return { ...kept, state: 'needs_attention', failure: 'run_overdue', reason: failureLabel('run_overdue') };
      }
      // Its process's own watch gives the run up; look again once that had time to land.
      return later;
    }
    // A run waiting for its turn, or one whose watch died with its lease, is still the dispatcher's
    // to start or take over; it hears that run's end.
    const decisions = await this.#context.workItems.listDeferredDecisions?.(card.orgId, card.factoryProjectId, {
      workItemId: card.workItemId,
      statuses: UNSETTLED_DECISIONS,
    });
    if (decisions?.some(record => record.decision.type === 'invokeSkill')) return later;
    const ended: FactoryRunEndedBinding = {
      id: binding.id,
      role: binding.role,
      orgId: binding.orgId,
      factoryProjectId: binding.factoryProjectId,
      workItemId: binding.workItemId,
      // One name per expiry, so a run end told for it again counts nothing.
      runEnd: `deadline:${pending.deadlineAt}`,
      runsAgain: true,
    };
    const next = await this.#stateAfterRunEnd(ended, previous);
    if (next?.state === 'running' && next.lastOutcome !== undefined) answer.outcome = ended;
    return next;
  }

  async #answeredWithoutCard(pending: PendingInput): Promise<boolean> {
    const asked =
      'runEnded' in pending
        ? pending.runEnded
        : 'runPaused' in pending
          ? pending.runPaused
          : 'runFailed' in pending
            ? pending.runFailed
            : 'runStopped' in pending
              ? pending.runStopped
              : 'deadline' in pending
                ? pending.deadline
                : pending.request;
    if (await this.#context.workItems.get({ orgId: asked.orgId, id: asked.workItemId })) return false;
    if ('runEnded' in pending) pending.answer = { outcome: false };
    else if ('runPaused' in pending) pending.answer = { paused: true };
    else if ('runFailed' in pending || 'runStopped' in pending) pending.answer = { heard: true };
    else if ('deadline' in pending) pending.answer = {};
    else pending.answer = { result: await this.#context.transitionService.transition(pending.request) };
    return true;
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
        if (await this.#answeredWithoutCard(pending)) return;
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

export interface WorkflowBoardEngineOptions {
  /** How long a card may stay `running` (default 6 h) or `probing` (default 30 min) before a sweep looks at it. */
  deadlines?: { runningMs?: number; probingMs?: number };
}

/**
 * The workflow engine. `createWorkflowBoardEngine` is a factory itself; call it with options
 * (`createWorkflowBoardEngine({ deadlines })`) to get one that uses them.
 */
export function createWorkflowBoardEngine(context: FactoryBoardEngineContext): WorkflowBoardEngine;
export function createWorkflowBoardEngine(options: WorkflowBoardEngineOptions): FactoryBoardEngineFactory;
export function createWorkflowBoardEngine(
  arg: FactoryBoardEngineContext | WorkflowBoardEngineOptions,
): WorkflowBoardEngine | FactoryBoardEngineFactory {
  if ('transitionService' in arg) return new WorkflowBoardEngine(arg);
  return context => new WorkflowBoardEngine(context, arg);
}
