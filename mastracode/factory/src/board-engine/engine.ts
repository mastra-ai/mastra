import type { AnyWorkflow } from '@mastra/core/workflows';

import type { BoardRegistry } from '../boards/index.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import { moveCardToBoard } from '../boards/relocate.js';
import { applyPhaseOutcome } from '../rules/phase-outcome-move.js';
import type { FactoryTransitionRequest, FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryRuleRejectionCode, FactoryTransitionResult } from '../rules/types.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import type {
  FactoryDispatchFailureCode,
  FactoryRunBindingRecord,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import type { FactoryCardRunState } from './board-workflow.js';

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
> & {
  /**
   * Names the run that ended, when whoever tells of it can: every telling of one run's end
   * carries the same name, so an engine that counts run ends counts it once.
   */
  runEnd?: string;
  /**
   * Set by a teller that decides whether the phase is run again when the run ended without an
   * outcome, as the dispatcher does: true when a second run follows, which makes the end a probe,
   * false when the teller gives the phase up. An end that says neither (a person's chat turn with
   * the card's session, a resumed run nobody watches) is followed by no second run.
   */
  runsAgain?: boolean;
};

/** A card and the role whose runs work it: the seat a run of the card's phase sits in, bound or not yet. */
export type FactoryCardSeat = Pick<FactoryRunEndedBinding, 'role' | 'orgId' | 'factoryProjectId' | 'workItemId'>;

/** One failed attempt at running a card's phase: its failure code, never its error text. */
export interface FactoryRunFailure {
  /** The dispatch failure's code, or a board rule's refusal code when a rule refused the run's move. */
  code: FactoryDispatchFailureCode | FactoryRuleRejectionCode;
  /** Which attempt of the decision failed, counting from 1. */
  attempt: number;
  /** True when no attempt follows this one. */
  terminal: boolean;
  /** The decision that ran the phase; with `attempt`, it names this failure. */
  decisionId: string;
}

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
  /**
   * Tells the engine that a run of a session bound to a card stopped to wait for a person: a tool
   * call held for approval, or a tool (a submitted plan) that asks for a yes or no. The run carries
   * on once someone answers. For an engine that keeps what a card is doing.
   */
  runPaused?(binding: FactoryRunEndedBinding, reason: 'approval'): Promise<void>;
  /**
   * Tells the engine that an attempt at running a card's phase failed, for an engine that keeps
   * what a card is doing. The dispatcher tells it once it recorded the failure, `terminal` when
   * it won't try again. It can be told more than once for one attempt.
   */
  runFailed?(seat: FactoryCardSeat, failure: FactoryRunFailure): Promise<void>;
  /**
   * Tells the engine that a person stopped the run of a session bound to a card, for an engine
   * that keeps what a card is doing. The card stays in its phase until someone starts it again.
   * `by` is the person who stopped it, for the card's audit trail.
   */
  runStopped?(seat: FactoryCardSeat, by?: { userId: string }): Promise<void>;
  /**
   * Looks at the cards whose automation is past its deadline at `now`, for an engine that keeps
   * deadlines; Factory calls it about once a minute in every process. Moves it makes go through
   * `engine`, the engine Factory holds.
   */
  sweep?(now: number, engine: Pick<FactoryBoardEngine, 'requestMove'>): Promise<void>;
  /**
   * What the card is doing as the engine last recorded it, for an engine that keeps that. Nothing
   * for a card it has no record of.
   */
  describe?(card: Pick<FactoryTransitionRequest, 'workItemId'>): Promise<FactoryCardRunState | undefined>;
  /**
   * Asks to move a card without waiting for the move, for an engine whose moves can take a while.
   * The engine checks what it can tell right away (the card, its revision, the move's edge). A
   * move that passes is answered with an input id and settles later; one that doesn't is
   * answered on the spot, as `requestMove` would.
   */
  submitMove?(request: FactoryTransitionRequest): Promise<FactorySubmittedMove>;
  /** Tells the engine a card was deleted, for an engine that keeps something per card to let go of. */
  cardDeleted?(card: Pick<FactoryTransitionRequest, 'workItemId'>): Promise<void>;
  /** Workflows the engine runs cards on; `MastraFactory` registers them with the host's Mastra. */
  readonly workflows?: Readonly<Record<string, AnyWorkflow>>;
}

/** A move taken on to settle later under `inputId`, or one answered right away. */
export type FactorySubmittedMove =
  | { inputId: string; settled: Promise<FactoryTransitionResult> }
  | { answered: FactoryTransitionResult };

/** The services an engine is built from; the host's `boardEngine` factory receives them. */
export interface FactoryBoardEngineContext {
  /** Factory's governed stage-transition service, with every board check and commit hook installed. */
  transitionService: Pick<FactoryTransitionService, 'transition'>;
  /** Reads the card a run ended on, with the outcome its session reported. */
  workItems: Pick<WorkItemsStorage, 'get'> &
    Partial<Pick<WorkItemsStorage, 'getTransitionResultByIngress' | 'listActiveRunBindings' | 'listDeferredDecisions'>>;
  /** The boards cards are filed on, built in and stored. */
  boards: BoardRegistry | ProjectBoardSource;
  /** The runs on a card's sessions, for an engine that stops them when a person moves the card. */
  runs?: FactoryCardRuns;
  /** The audit trail, for an engine that records when a card comes to need attention. */
  audit?: AuditRecorder;
}

type CardAddress = Pick<FactoryTransitionRequest, 'orgId' | 'factoryProjectId' | 'workItemId'>;

export interface FactoryCardRuns {
  /** Whether a run is in flight on any of the card's sessions. */
  inFlight(card: CardAddress): Promise<boolean>;
  /**
   * Stops the runs in flight on the card's sessions for the person `by`, as that person's Stop
   * does, or for Factory itself without one; they end on their own time. Answers whether it
   * stopped any: a run another process holds is out of its reach, and with a run on a session
   * that person may not drive, it stops none.
   */
  stop(card: CardAddress, by?: { userId: string }): Promise<boolean>;
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
