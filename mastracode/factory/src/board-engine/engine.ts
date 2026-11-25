import type { AnyWorkflow } from '@mastra/core/workflows';

import type { BoardRegistry } from '../boards/index.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import { moveCardToBoard } from '../boards/relocate.js';
import { applyPhaseOutcome } from '../rules/phase-outcome-move.js';
import type { FactoryTransitionRequest, FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryTransitionResult } from '../rules/types.js';
import type { FactoryRunBindingRecord, WorkItemsStorage } from '../storage/domains/work-items/base.js';

/**
 * A card filed somewhere without a transition: re-filed by a reconcile pass, or moved to another
 * board by an intake route change. No phase rule runs for it and no transition is recorded.
 */
export type FactoryCardPlacement = Parameters<typeof moveCardToBoard>[0];

/** `moved` when the card was placed, `unchanged` when it already sat there, `skipped` when it could not move. */
export type FactoryCardPlacementResult = Awaited<ReturnType<typeof moveCardToBoard>>;

/** The run binding of a session whose run ended: which card, and the role that worked it. */
export type FactoryRunEndedBinding = Pick<
  FactoryRunBindingRecord,
  'id' | 'role' | 'orgId' | 'factoryProjectId' | 'workItemId'
>;

/**
 * Decides how a card moves across its board. Every stage change from outside the engine (a
 * person's move, the chat move tool, card creation, a run start, an agent's move or verdict, a
 * tool-result rule, a card re-filed or rerouted to another board) is requested here; nothing outside the engine calls the transition service.
 *
 * The host picks one engine per deployment with `MastraFactory`'s `boardEngine` option.
 */
export interface FactoryBoardEngine {
  /**
   * Asks to move a card; the engine may refuse, and answers with the board's verdict.
   *
   * A request is identified by its `ingress.identity`, and the same move can be requested more
   * than once under one identity, from different places and concurrently: an agent's tool result
   * asks right away, and the dispatcher replays the queued decision later. The engine must give
   * every request with an identity it has already answered that first verdict (a lost revision
   * race, `stale`, excepted), whatever else differs between the requests. The default engine
   * gets this from the transition service, which records each verdict under its identity.
   */
  requestMove(request: FactoryTransitionRequest): Promise<FactoryTransitionResult>;
  /** Asks to file a card on a board and phase without a transition; the engine may answer `skipped`. */
  requestPlacement(placement: FactoryCardPlacement): Promise<FactoryCardPlacementResult>;
  /**
   * Tells the engine that a run of a session bound to a card ended `complete`. The engine decides
   * what ends the phase: the outcome the session reported, or its exit tool's success. Answers
   * true when the run's phase ended and the card moved on, false when the card holds no outcome
   * for its phase. A refused outcome throws a `FactoryRuleRejectedError`.
   *
   * It can be told more than once for one run end (the dispatcher watching the run and the session
   * itself both see it), and must move the card once.
   *
   * `engine` is the engine Factory holds, which may wrap this one. Request the run's move through
   * it, so a wrapping engine sees that move like any other.
   */
  runEnded(binding: FactoryRunEndedBinding, engine: Pick<FactoryBoardEngine, 'requestMove'>): Promise<boolean>;
  /** Workflows the engine runs cards on; `MastraFactory` registers them with the host's Mastra. */
  readonly workflows?: Readonly<Record<string, AnyWorkflow>>;
}

/** The services an engine is built from; the host's `boardEngine` factory receives them. */
export interface FactoryBoardEngineContext {
  /** Factory's governed stage-transition service, with every board check and commit hook installed. */
  transitionService: Pick<FactoryTransitionService, 'transition'>;
  /** Reads the card a run ended on, with the outcome its session reported. */
  workItems: Pick<WorkItemsStorage, 'get'>;
  /** The boards cards are filed on, built in and stored. */
  boards: BoardRegistry | ProjectBoardSource;
}

export type FactoryBoardEngineFactory = (context: FactoryBoardEngineContext) => FactoryBoardEngine;

/**
 * Today's engine: a move request commits synchronously through the transition service, and the
 * follow-up work it queues is run by the decision dispatcher. A run's end moves the card by the
 * outcome its session reported, as one more move request.
 */
export class DispatcherBoardEngine implements FactoryBoardEngine {
  readonly #transitionService: Pick<FactoryTransitionService, 'transition'>;
  readonly #workItems: Pick<WorkItemsStorage, 'get'>;
  readonly #boards: BoardRegistry | ProjectBoardSource;

  constructor(context: FactoryBoardEngineContext) {
    this.#transitionService = context.transitionService;
    this.#workItems = context.workItems;
    this.#boards = context.boards;
  }

  requestMove(request: FactoryTransitionRequest): Promise<FactoryTransitionResult> {
    return this.#transitionService.transition(request);
  }

  requestPlacement(placement: FactoryCardPlacement): Promise<FactoryCardPlacementResult> {
    return moveCardToBoard(placement);
  }

  /** Moves the card by its phase's outcome, as a move request from the agent that worked it. */
  runEnded(binding: FactoryRunEndedBinding, engine: Pick<FactoryBoardEngine, 'requestMove'>): Promise<boolean> {
    return applyPhaseOutcome({ storage: this.#workItems, boards: this.#boards, boardEngine: engine }, binding);
  }
}

export const createDispatcherBoardEngine: FactoryBoardEngineFactory = context => new DispatcherBoardEngine(context);
