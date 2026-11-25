import { isRunFenceConflictError, runOutsideRunFenceScope } from '@mastra/core/storage';

import { moveCardToBoard } from '../boards/relocate.js';
import { FactoryRuleRejectedError } from '../rules/dispatch-errors.js';
import { applyPhaseOutcome } from '../rules/phase-outcome-move.js';
import type { FactoryTransitionRequest } from '../rules/transition-service.js';
import type { FactoryTransitionResult } from '../rules/types.js';
import { boardRunId, createFactoryBoardWorkflow, FACTORY_BOARD_WORKFLOW_ID } from './board-workflow.js';
import type {
  FactoryBoardWorkflow,
  FactoryCardAnswer,
  FactoryCardInput,
  FactoryCardInputError,
} from './board-workflow.js';
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

type CardRef = Pick<FactoryTransitionRequest, 'orgId' | 'factoryProjectId' | 'workItemId'>;

function rethrow(error: FactoryCardInputError): never {
  if (error.name === 'FactoryRuleRejectedError' && error.code) {
    const prefix = `${error.code}: `;
    const reason = error.message.startsWith(prefix) ? error.message.slice(prefix.length) : error.message;
    throw new FactoryRuleRejectedError(
      error.code as ConstructorParameters<typeof FactoryRuleRejectedError>[0],
      reason,
      error.settled ?? false,
    );
  }
  throw Object.assign(new Error(error.message), { name: error.name, ...(error.stack ? { stack: error.stack } : {}) });
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

  constructor(context: FactoryBoardEngineContext) {
    this.workflow = createFactoryBoardWorkflow({
      requestMove: request => context.transitionService.transition(request),
      runEnded: binding =>
        applyPhaseOutcome(
          {
            storage: context.workItems,
            boards: context.boards,
            boardEngine: { requestMove: request => context.transitionService.transition(request) },
          },
          binding,
        ),
    });
  }

  /** The workflows the host registers with Mastra. */
  get workflows(): Record<string, FactoryBoardWorkflow> {
    return { [FACTORY_BOARD_WORKFLOW_ID]: this.workflow };
  }

  async requestMove(request: FactoryTransitionRequest): Promise<FactoryTransitionResult> {
    const answer = await this.#ask(request, { type: 'move', inputId: crypto.randomUUID(), request });
    if ('error' in answer) rethrow(answer.error);
    if (answer.type !== 'move') throw new Error(`The card's run answered a move with ${answer.type}.`);
    return answer.result;
  }

  /** Filing a card elsewhere runs no phase and records no transition, so it needs no run. */
  requestPlacement(placement: FactoryCardPlacement): Promise<FactoryCardPlacementResult> {
    return moveCardToBoard(placement);
  }

  async runEnded(binding: FactoryRunEndedBinding): Promise<boolean> {
    const answer = await this.#ask(binding, {
      type: 'run_ended',
      inputId: crypto.randomUUID(),
      binding: {
        id: binding.id,
        role: binding.role,
        orgId: binding.orgId,
        factoryProjectId: binding.factoryProjectId,
        workItemId: binding.workItemId,
      },
    });
    if ('error' in answer) rethrow(answer.error);
    if (answer.type !== 'run_ended') throw new Error(`The card's run answered a run end with ${answer.type}.`);
    return answer.moved;
  }

  #ask(card: CardRef, input: FactoryCardInput): Promise<FactoryCardAnswer> {
    const previous = this.#queues.get(card.workItemId) ?? Promise.resolve();
    // A run end can be told from work a step of this same run started (the phase's session), which
    // still carries the claim that step held. The input is new work on the run: it claims it afresh.
    const next = previous.catch(() => undefined).then(() => runOutsideRunFenceScope(() => this.#resume(card, input)));
    this.#queues.set(card.workItemId, next);
    void next
      .catch(() => undefined)
      .finally(() => {
        if (this.#queues.get(card.workItemId) === next) this.#queues.delete(card.workItemId);
      });
    return next;
  }

  async #resume(card: CardRef, input: FactoryCardInput): Promise<FactoryCardAnswer> {
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
        await this.#start(card, runId);
        continue;
      }
      if (stored.status === 'suspended') {
        const run = await this.workflow.createRun({ runId });
        try {
          const result = await run.resume({ step: 'phase', resumeData: { input } });
          if (result.status !== 'suspended') {
            throw new Error(`The card's board run ended ${result.status} instead of waiting for its next input.`);
          }
          const answer = (result.suspendPayload as { phase?: { answer?: FactoryCardAnswer } }).phase?.answer;
          if (answer?.inputId !== input.inputId) throw new Error("The card's board run did not answer the input.");
          return answer;
        } catch (error) {
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
  async #start(card: CardRef, runId: string): Promise<void> {
    const run = await this.workflow.createRun({ runId });
    try {
      const result = await run.start({
        inputData: { orgId: card.orgId, factoryProjectId: card.factoryProjectId, workItemId: card.workItemId },
      });
      if (result.status !== 'suspended') {
        throw new Error(`The card's board run ended ${result.status} instead of waiting for its first input.`);
      }
    } catch (error) {
      if (!isRunFenceConflictError(error)) throw error;
    }
  }
}

export const createWorkflowBoardEngine: FactoryBoardEngineFactory = context => new WorkflowBoardEngine(context);
