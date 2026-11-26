import { isRunFenceConflictError, runOutsideRunFenceScope } from '@mastra/core/storage';

import { moveCardToBoard } from '../boards/relocate.js';
import { applyPhaseOutcome } from '../rules/phase-outcome-move.js';
import type { FactoryTransitionRequest } from '../rules/transition-service.js';
import type { FactoryTransitionResult } from '../rules/types.js';
import { boardRunId, createFactoryBoardWorkflow, FACTORY_BOARD_WORKFLOW_ID } from './board-workflow.js';
import type { FactoryBoardWorkflow } from './board-workflow.js';
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

/** A move waiting for the card's run to apply it, and what applying it gave. */
interface PendingInput {
  request: FactoryTransitionRequest;
  answer?: { result: FactoryTransitionResult } | { error: unknown };
}

type CardRef = Pick<FactoryTransitionRequest, 'workItemId'>;

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

  constructor(context: FactoryBoardEngineContext) {
    this.#context = context;
    this.workflow = createFactoryBoardWorkflow({
      apply: async (inputId, workItemId) => {
        const pending = this.#pending.get(inputId);
        if (!pending || pending.answer || pending.request.workItemId !== workItemId) return;
        try {
          pending.answer = { result: await context.transitionService.transition(pending.request) };
        } catch (error) {
          // A failed move is the caller's to report; the card's run keeps waiting for the next one.
          pending.answer = { error };
        }
      },
    });
  }

  /** The workflows the host registers with Mastra. */
  get workflows(): Record<string, FactoryBoardWorkflow> {
    return { [FACTORY_BOARD_WORKFLOW_ID]: this.workflow };
  }

  async requestMove(request: FactoryTransitionRequest): Promise<FactoryTransitionResult> {
    const inputId = crypto.randomUUID();
    const pending: PendingInput = { request };
    this.#pending.set(inputId, pending);
    try {
      await this.#ask(request, inputId, pending);
    } finally {
      this.#pending.delete(inputId);
    }
    if (!pending.answer) throw new Error("The card's board run did not apply the move.");
    if ('error' in pending.answer) throw pending.answer.error;
    return pending.answer.result;
  }

  /** Filing a card elsewhere runs no phase and records no transition, so it needs no run. */
  requestPlacement(placement: FactoryCardPlacement): Promise<FactoryCardPlacementResult> {
    return moveCardToBoard(placement);
  }

  /**
   * Moves the card by its phase's outcome, requested through the engine Factory holds, so the move
   * reaches this card's run as one more input (and a wrapping engine sees it).
   */
  runEnded(binding: FactoryRunEndedBinding, engine: Pick<FactoryBoardEngine, 'requestMove'>): Promise<boolean> {
    return applyPhaseOutcome(
      { storage: this.#context.workItems, boards: this.#context.boards, boardEngine: engine },
      binding,
    );
  }

  #ask(card: CardRef, inputId: string, pending: PendingInput): Promise<void> {
    const previous = this.#queues.get(card.workItemId) ?? Promise.resolve();
    // A run end can be told from work a step of this same run started (the phase's session), which
    // still carries the claim that step held. The input is new work on the run: it claims it afresh.
    const next = previous
      .catch(() => undefined)
      .then(() => runOutsideRunFenceScope(() => this.#resume(card, inputId, pending)));
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
          if (result.status === 'suspended') throw new Error("The card's board run did not apply the move.");
          // The run this process held ended without taking the move (another process may have
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
