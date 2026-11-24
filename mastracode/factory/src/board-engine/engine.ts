import type { FactoryTransitionRequest, FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryTransitionResult } from '../rules/types.js';

/**
 * Decides how a card moves across its board. Every stage change from outside the engine (a
 * person's move, the chat move tool, card creation, a run start, an agent's move or verdict, a
 * tool-result rule) is requested here; nothing outside the engine calls the transition service.
 *
 * The host picks one engine per deployment with `MastraFactory`'s `boardEngine` option.
 */
export interface FactoryBoardEngine {
  /** Asks to move a card; the engine may refuse, and answers with the board's verdict. */
  requestMove(request: FactoryTransitionRequest): Promise<FactoryTransitionResult>;
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
}

export const createDispatcherBoardEngine: FactoryBoardEngineFactory = context => new DispatcherBoardEngine(context);
