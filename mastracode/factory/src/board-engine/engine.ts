import { moveCardToBoard } from '../boards/relocate.js';
import type { FactoryTransitionRequest, FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryTransitionResult } from '../rules/types.js';

/**
 * A card filed somewhere without a transition: re-filed by a reconcile pass, or moved to another
 * board by an intake route change. No phase rule runs for it and no transition is recorded.
 */
export type FactoryCardPlacement = Parameters<typeof moveCardToBoard>[0];

/** `moved` when the card was placed, `unchanged` when it already sat there, `skipped` when it could not move. */
export type FactoryCardPlacementResult = Awaited<ReturnType<typeof moveCardToBoard>>;

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
}

/** The services an engine is built from; the host's `boardEngine` factory receives them. */
export interface FactoryBoardEngineContext {
  /** Factory's governed stage-transition service, with every board check and commit hook installed. */
  transitionService: Pick<FactoryTransitionService, 'transition'>;
}

export type FactoryBoardEngineFactory = (context: FactoryBoardEngineContext) => FactoryBoardEngine;

/**
 * Today's engine: a move request commits synchronously through the transition service, and the
 * follow-up work it queues is run by the decision dispatcher.
 */
export class DispatcherBoardEngine implements FactoryBoardEngine {
  readonly #transitionService: Pick<FactoryTransitionService, 'transition'>;

  constructor(context: FactoryBoardEngineContext) {
    this.#transitionService = context.transitionService;
  }

  requestMove(request: FactoryTransitionRequest): Promise<FactoryTransitionResult> {
    return this.#transitionService.transition(request);
  }

  requestPlacement(placement: FactoryCardPlacement): Promise<FactoryCardPlacementResult> {
    return moveCardToBoard(placement);
  }
}

export const createDispatcherBoardEngine: FactoryBoardEngineFactory = context => new DispatcherBoardEngine(context);
