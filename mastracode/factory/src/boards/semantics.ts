import type {
  FactoryRuleBoardClosure,
  FactoryRuleBoardFlow,
  FactoryRuleIntakeTarget,
  FactoryRulePhaseContext,
} from '../rules/types.js';
import type { Card } from '../storage/domains/work-items/base.js';
import type { MetricsPhaseOutcomes } from '../storage/domains/work-items/metrics.js';
import type { WorkItemSourceRow } from '../storage/domains/work-items/work-item-schema.js';
import { workItemBranch, workItemBranchSource } from '../work-item-branch.js';
import { DEFAULT_BOARD_ID } from './default-board.js';
import { REVIEW_CONTEXT } from './define-board.js';
import type {
  BoardEventIntegration,
  BoardEventRules,
  BoardPhase,
  BoardPhaseKind,
  BoardToolResultRuleHandler,
} from './define-board.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';
import { reviewBoard } from './review.js';
import { workBoard } from './work.js';

export interface PhaseSemantics {
  readonly kind: BoardPhaseKind;
  /** Seat that carries a working phase; absent for resting and terminal phases. */
  readonly role?: string;
}

/**
 * Board that owns a work item. Rows created before boards were persisted carry no `board`;
 * they belong to the default board. (Pull requests used to default to the retired Review board;
 * storage reads those rows as the default board, and keeps cards stored on Review there only in a
 * project that still uses it.)
 */
export function boardForWorkItem(item: Pick<Card, 'board'>): string {
  return item.board ?? DEFAULT_BOARD_ID;
}

const flows = new WeakMap<object, FactoryRuleBoardFlow>();

/**
 * The phases a board's pull request loop runs through, read from what each phase declares
 * rather than from its key:
 *
 * Only phases running in the {@link REVIEW_CONTEXT} seat count as reviews: it is the only seat
 * that records verdicts.
 *
 * - `pullRequestReview`: the first phase that grants `factory_review_source`. It takes pull
 *   requests: a pull request's own card is reviewed there, an attached pull request is reviewed
 *   there, verdicts on pull requests are recorded there, and a push or review request re-enters it.
 * - `selfReview`: the first working phase that grants `factory_record_review_verdict` without
 *   `factory_review_source`: an independent review of the builder's branch before a pull request.
 * - `triage`: the first working phase that neither builds (runs in `buildRole`) nor reviews: it
 *   sorts new cards before anyone accepts them.
 * - `build`: the last working phase, in declaration order, that is neither of those and can move
 *   into the review that follows it (`selfReview`, else `pullRequestReview`). Self-review sends
 *   requested changes back here, and its seat (`buildRole`) is woken by pull request feedback.
 *
 * A board without a `factory_review_source` phase has no pull request loop.
 */
export function boardFlow(board: InstalledBoard | undefined): FactoryRuleBoardFlow {
  if (!board) return Object.freeze({});
  const cached = flows.get(board);
  if (cached) return cached;
  const entries = Object.entries(board.phases) as [string, BoardPhase<string>][];
  const grants = (phase: BoardPhase<string>, tool: string) =>
    phase.kind === 'working' &&
    phase.runner.context === REVIEW_CONTEXT &&
    (phase.tools ?? []).some(granted => granted === tool);
  const pullRequestReview = entries.find(([, phase]) => grants(phase, 'factory_review_source'))?.[0];
  const selfReview = entries.find(
    ([key, phase]) =>
      key !== pullRequestReview &&
      grants(phase, 'factory_record_review_verdict') &&
      !grants(phase, 'factory_review_source'),
  )?.[0];
  const handoff = selfReview ?? pullRequestReview;
  const build = handoff
    ? entries.findLast(
        ([key, phase]) =>
          phase.kind === 'working' &&
          key !== pullRequestReview &&
          key !== selfReview &&
          board.allowsTransition(key, handoff),
      )?.[0]
    : undefined;
  const buildRole = build ? board.roleForPhase(build) : undefined;
  const triage = entries.find(
    ([key, phase]) =>
      phase.kind === 'working' &&
      key !== build &&
      phase.runner.context !== REVIEW_CONTEXT &&
      (buildRole === undefined || phase.runner.context !== buildRole),
  )?.[0];
  const terminals = entries.filter(([, phase]) => phase.kind === 'terminal').map(([key]) => key);
  const completed = board.sourceClosed?.completed ?? terminals[0];
  const canceled = board.sourceClosed?.canceled ?? terminals.find(key => key !== completed) ?? completed;
  const ref = (phase: string) => Object.freeze({ phase, title: board.phases[phase]!.name });
  const flow = Object.freeze({
    initialPhase: board.initialPhase,
    ...(completed ? { completed: ref(completed) } : {}),
    ...(canceled ? { canceled: ref(canceled) } : {}),
    ...(triage ? { triage } : {}),
    ...(pullRequestReview ? { pullRequestReview } : {}),
    ...(selfReview ? { selfReview } : {}),
    ...(build ? { build } : {}),
    ...(buildRole ? { buildRole } : {}),
  });
  flows.set(board, flow);
  return flow;
}

/**
 * Where new items land on `board`, else on the project's default board when `board` is not
 * installed. Undefined when neither is.
 */
export function intakeTarget(
  boards: Pick<BoardRegistry, 'get'>,
  board?: InstalledBoard,
): FactoryRuleIntakeTarget | undefined {
  const target = board ?? boards.get(DEFAULT_BOARD_ID);
  if (!target) return undefined;
  const { pullRequestReview } = boardFlow(target);
  return Object.freeze({
    board: target.id,
    initialPhase: target.initialPhase,
    ...(pullRequestReview ? { pullRequestReview } : {}),
  });
}

/** {@link intakeTarget} as a rule context field. */
export function withIntakeTarget(
  boards: Pick<BoardRegistry, 'get'>,
  board?: InstalledBoard,
): { intake?: FactoryRuleIntakeTarget } {
  const intake = intakeTarget(boards, board);
  return intake ? { intake } : {};
}

/** {@link boardFlow} of the board a card sits on. */
export function cardBoardFlow(
  boards: Pick<BoardRegistry, 'get'>,
  item: Pick<Card, 'board'> | undefined,
): FactoryRuleBoardFlow {
  return item ? boardFlow(boards.get(boardForWorkItem(item))) : Object.freeze({});
}

/**
 * Whether a card in `stage` is still waiting for someone to accept it: it rests, or it is being
 * triaged. Approval labels hold only such cards.
 */
export function awaitsAcceptance(board: InstalledBoard | undefined, stage: string): boolean {
  if (!board) return false;
  return board.phaseKind(stage) === 'resting' || stage === boardFlow(board).triage;
}

/** Whether `stage` is the phase where the board reviews pull requests. */
export function isPullRequestReviewPhase(board: InstalledBoard | undefined, stage: string | undefined): boolean {
  const phase = boardFlow(board).pullRequestReview;
  return phase !== undefined && phase === stage;
}

/**
 * Why a move breaks the shape of a card on a board with a pull request loop, or undefined when it
 * does not: a pull request's own card is only reviewed, so it enters no other working phase, and
 * the pull request review phase holds only cards that carry a pull request (their own, or one
 * attached to their issue). `nextPhases` cannot say this: a resting phase may lead to both, and
 * which one fits depends on the card.
 */
export function pullRequestCardRejection(
  board: InstalledBoard,
  card: { readonly standalonePullRequest: boolean; readonly hasPullRequest: boolean },
  toStage: string,
): string | undefined {
  const review = boardFlow(board).pullRequestReview;
  if (!review) return undefined;
  const reviewName = board.phases[review]?.name ?? review;
  if (!card.hasPullRequest && toStage === review) {
    return `${reviewName} holds only cards with a pull request; this work item enters it once a pull request is attached to it.`;
  }
  if (!card.standalonePullRequest || toStage === review || !board.isWorking(toStage)) return undefined;
  const exits = [review, ...Object.keys(board.phases).filter(key => board.isTerminal(key))];
  return `A pull request card is only reviewed on the ${board.name} board; it cannot enter ${toStage}. Move it to ${exits.join(', ')}.`;
}

/** `{ flow }` for spreading into an integration rule context, or `{}` for an unbound evaluation. */
export function withBoardFlow(
  boards: Pick<BoardRegistry, 'get'>,
  item: Pick<Card, 'board'> | undefined,
): { flow?: FactoryRuleBoardFlow } {
  return item ? { flow: cardBoardFlow(boards, item) } : {};
}

interface SourcedItem {
  readonly workItem?: { readonly sources?: readonly WorkItemSourceRow[] } | null;
}

/**
 * A card whose own primary source is a pull or merge request: an outside contributor's
 * PR filed on its own card, or a PR card filed before PRs attached to their issue's card.
 * An issue card with an attached PR is not one; see {@link hasPullRequest}.
 */
export function isPullRequestCard(item: { readonly source: string }): boolean {
  return item.source === 'github-pr' || item.source === 'gitlab-pr';
}

/** Every pull or merge request source on a card, oldest first. */
export function pullRequestSources(item: SourcedItem): WorkItemSourceRow[] {
  return (item.workItem?.sources ?? []).filter(source => source.sourceType === 'pull-request');
}

/** Whether a card carries a pull or merge request: its own, or one attached to its issue. */
export function hasPullRequest(item: SourcedItem & { readonly source?: string }): boolean {
  return (
    (item.source !== undefined && isPullRequestCard({ source: item.source })) || pullRequestSources(item).length > 0
  );
}

/** A source row's external id without the type/workspace scope storage prefixes it with. */
export function sourceExternalId(source: Pick<WorkItemSourceRow, 'sourceType' | 'workspaceId' | 'externalId'>): string {
  const prefix = `${source.sourceType}:${source.workspaceId ? `${source.workspaceId}:` : ''}`;
  return source.externalId.startsWith(prefix) ? source.externalId.slice(prefix.length) : source.externalId;
}

/** The provider number (GitHub PR number, GitLab MR IID) a pull request source names. */
export function pullRequestSourceNumber(source: Pick<WorkItemSourceRow, 'metadata'>): number | undefined {
  const metadata = source.metadata ?? {};
  const value = metadata.githubPullRequestNumber ?? metadata.gitlabMergeRequestIid ?? metadata.number;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function openSource(source: Pick<WorkItemSourceRow, 'state' | 'metadata'>): boolean {
  const state = source.state ?? source.metadata?.state;
  return state !== 'closed' && state !== 'merged' && source.metadata?.merged !== true;
}

/**
 * The pull request a PR review pass on this card reviews: the one the card's
 * `openPullRequestNumber` names, else the newest open one, else the newest one.
 */
export function reviewedPullRequest(
  item: SourcedItem & { readonly metadata?: Record<string, unknown> | null },
): WorkItemSourceRow | undefined {
  const sources = pullRequestSources(item);
  const pointer = item.metadata?.openPullRequestNumber;
  return (
    (typeof pointer === 'number' ? sources.find(source => pullRequestSourceNumber(source) === pointer) : undefined) ??
    sources.findLast(openSource) ??
    sources.at(-1)
  );
}

/** The newest still-open pull request on a card other than `except`, for re-pointing `openPullRequestNumber`. */
export function newestOpenPullRequestNumber(item: SourcedItem, except?: number): number | null {
  const open = pullRequestSources(item).filter(
    source => openSource(source) && pullRequestSourceNumber(source) !== except,
  );
  return (open.length ? pullRequestSourceNumber(open.at(-1)!) : undefined) ?? null;
}

interface SessionedItem {
  readonly sessions: Readonly<Record<string, { readonly branch?: string | null } | undefined>>;
}

type BranchedItem = Pick<Card, 'id' | 'externalSource'> & { readonly workItem: Pick<Card['workItem'], 'metadata'> };

/**
 * Whether a pull request from `headBranch` was opened by the card's own sessions: the head is
 * one of its session branches, or the branch Factory builds the card on (stable even after its
 * session is deleted).
 */
export function cardOwnsBranch(item: SessionedItem & BranchedItem, headBranch: string | undefined): boolean {
  if (!headBranch) return false;
  const buildBranch = workItemBranch({
    id: item.id,
    source: workItemBranchSource(item.externalSource),
    metadata: item.workItem.metadata,
  });
  return buildBranch === headBranch || Object.values(item.sessions).some(session => session?.branch === headBranch);
}

/** The newest open pull request the card's own sessions opened, other than `except`. */
export function newestOwnedOpenPullRequestNumber(
  item: SourcedItem & SessionedItem & BranchedItem,
  except?: number,
): number | null {
  const open = pullRequestSources(item).filter(
    source =>
      openSource(source) &&
      pullRequestSourceNumber(source) !== except &&
      typeof source.metadata?.headBranch === 'string' &&
      cardOwnsBranch(item, source.metadata.headBranch),
  );
  return (open.length ? pullRequestSourceNumber(open.at(-1)!) : undefined) ?? null;
}

/** The pull or merge request a card's PR review covers, whichever card shape carries it. */
export interface ReviewedChangeRequest {
  readonly provider: 'github' | 'gitlab';
  readonly number: number | undefined;
  readonly url: string | null;
  readonly headBranch: string | undefined;
  /** The card is the change request's own card rather than an issue card it is attached to. */
  readonly standalone: boolean;
}

/**
 * What a PR review on this card reviews: the card's own change request when the card is one,
 * otherwise the attached one {@link reviewedPullRequest} picks. Undefined for a card with none.
 */
export function reviewedChangeRequest(item: {
  readonly source: string;
  readonly url?: string | null;
  readonly metadata?: Record<string, unknown> | null;
  readonly workItem: {
    readonly url?: string | null;
    readonly metadata?: Record<string, unknown> | null;
    readonly sources?: readonly WorkItemSourceRow[];
  };
}): ReviewedChangeRequest | undefined {
  if (isPullRequestCard(item)) {
    const metadata = item.workItem.metadata ?? {};
    const gitlab = item.source === 'gitlab-pr';
    const value = (gitlab ? metadata.gitlabMergeRequestIid : metadata.githubPullRequestNumber) ?? metadata.number;
    return {
      provider: gitlab ? 'gitlab' : 'github',
      number: typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined,
      url: item.url ?? item.workItem.url ?? null,
      headBranch: typeof metadata.headBranch === 'string' ? metadata.headBranch : undefined,
      standalone: true,
    };
  }
  const source = reviewedPullRequest(item);
  if (!source) return undefined;
  return {
    provider: source.integrationId === 'gitlab' ? 'gitlab' : 'github',
    number: pullRequestSourceNumber(source),
    url: source.url ?? null,
    headBranch: typeof source.metadata?.headBranch === 'string' ? source.metadata.headBranch : undefined,
    standalone: false,
  };
}

/**
 * Whether a pass already recorded a verdict on `change`. An issue card can carry
 * several pull requests, so a verdict stamped for another one doesn't count; a
 * verdict with no number (a standalone card, or one stamped before verdicts named
 * their pull request) covers the card.
 */
export function hasRecordedVerdict(
  item: Parameters<typeof reviewedChangeRequest>[0],
  change: Pick<ReviewedChangeRequest, 'number'> | undefined = reviewedChangeRequest(item),
): boolean {
  const covered = item.metadata?.reviewedPullRequestNumber;
  const reviewedAnother = typeof covered === 'number' && change?.number !== undefined && covered !== change.number;
  return typeof item.metadata?.reviewVerdict === 'string' && !reviewedAnother;
}

/**
 * Whether the rule's card carries a change request its board reviews: the card has one, and its
 * board has a phase that takes pull requests ({@link boardFlow}).
 */
export function reviewsPullRequest(context: {
  readonly flow?: Pick<FactoryRuleBoardFlow, 'pullRequestReview'>;
  readonly item?: SourcedItem & { readonly source: string };
}): boolean {
  return context.flow?.pullRequestReview !== undefined && context.item !== undefined && hasPullRequest(context.item);
}

/**
 * What the installed board says `phase` means. Returns undefined when the board is not
 * installed or does not declare the phase; callers must fail closed on undefined rather
 * than guess from the phase name.
 */
export function resolvePhaseSemantics(
  boards: BoardRegistry,
  boardId: string,
  phase: string,
): PhaseSemantics | undefined {
  const board = boards.get(boardId);
  const kind = board?.phaseKind(phase);
  if (!board || !kind) return undefined;
  const role = board.roleForPhase(phase);
  return role === undefined ? { kind } : { kind, role };
}

/**
 * Tool-result rule the installed board declares for `toolName`. Undefined when the board is
 * not installed or declares no rule for the tool; callers must run nothing in that case.
 */
export function resolveBoardToolRule(
  boards: BoardRegistry,
  boardId: string,
  toolName: string,
): BoardToolResultRuleHandler | undefined {
  return boards.get(boardId)?.tools[toolName]?.onResult;
}

/**
 * Integration event handlers the installed board declares for cards on it, or undefined when the
 * card is unbound, the board is not installed, or it declares none for this integration. Within the
 * map, `null` means the board switched that event off for its cards.
 */
export function boardEventHandlers<I extends BoardEventIntegration>(
  boards: Pick<BoardRegistry, 'get'>,
  boardId: string | undefined,
  integration: I,
): BoardEventRules[I] | undefined {
  return boardId === undefined ? undefined : boards.get(boardId)?.events[integration];
}

/**
 * Board whose event handlers answer an integration evaluation: the bound card's board, except on
 * the evaluation that files a pull request's own Review card, which is about a card that does
 * not exist yet.
 */
export function eventBoardId(context: {
  readonly item?: unknown;
  readonly board?: string;
  readonly pullRequestIntake?: boolean;
}): string | undefined {
  return context.item && !context.pullRequestIntake ? context.board : undefined;
}

/** What a card's single current phase means on its installed board, for integration rule contexts. */
export function rulePhaseContext(
  boards: Pick<BoardRegistry, 'get'>,
  item: Pick<Card, 'board' | 'externalSource' | 'stages'>,
): FactoryRulePhaseContext | undefined {
  const stage = item.stages.length === 1 ? item.stages[0] : undefined;
  if (!stage) return undefined;
  const board = boards.get(boardForWorkItem(item));
  const kind = board?.phaseKind(stage);
  if (!board || !kind) return undefined;
  const context = board.roleForPhase(stage);
  const phase = board.phases[stage];
  return Object.freeze({
    id: stage,
    kind,
    ...(context === undefined ? {} : { context, role: context }),
    nextPhases: Object.freeze([...(phase?.nextPhases ?? [])]),
  });
}

/**
 * Whether a persisted card has finished, judged by the board it sits on: the installed board's
 * phase kind first, then, for rows whose board is not installed, the phase kinds of the default
 * board Factory seeds or of the retired Review board. Unknown boards or phases are never terminal,
 * so a card is only ever released from ownership on the board's own say-so.
 */
export function isTerminalWorkItem(
  boards: BoardRegistry,
  item: Pick<Card, 'board' | 'externalSource' | 'stages'>,
): boolean {
  const semantics = workItemPhaseSemantics(boards, item);
  if (semantics) return semantics.kind === 'terminal';
  const board = boardForWorkItem(item);
  if (boards.has(board)) return false;
  const seed = board === DEFAULT_BOARD_ID ? workBoard : board === reviewBoard.id ? reviewBoard : undefined;
  const stage = item.stages.length === 1 ? item.stages[0] : undefined;
  return stage !== undefined && seed !== undefined && seed.isTerminal(stage);
}

/** Semantics of the single stage a work item currently occupies; undefined for multi-stage rows. */
export function workItemPhaseSemantics(
  boards: BoardRegistry,
  item: Pick<Card, 'board' | 'externalSource' | 'stages'>,
): PhaseSemantics | undefined {
  const stage = item.stages.length === 1 ? item.stages[0] : undefined;
  if (!stage) return undefined;
  return resolvePhaseSemantics(boards, boardForWorkItem(item), stage);
}

/**
 * Flow-metric outcomes of each board's phases: the phase the board closes completed sources into
 * (else its first terminal phase) completes a card, other terminal phases cancel it, resting
 * phases queue it, and anything else (working, or a phase the board no longer declares) is in
 * flight.
 */
export function boardPhaseOutcomes(boards: Pick<BoardRegistry, 'get'>): MetricsPhaseOutcomes {
  return (item, stage) => {
    const board = boards.get(boardForWorkItem(item));
    const kind = board?.phaseKind(stage);
    if (!board || kind === undefined || kind === 'working') return 'pipeline';
    if (kind === 'resting') return 'queued';
    const completed = board.sourceClosed?.completed ?? Object.keys(board.phases).find(key => board.isTerminal(key));
    return stage === completed ? 'completed' : 'canceled';
  };
}

/**
 * Where source-closed rules send a persisted card: the `sourceClosed` mapping its installed
 * board declares, plus whether the card already sits in a terminal phase. Undefined when the
 * board is not installed or declares no mapping, so closing the source leaves the card alone.
 */
export function resolveBoardClosure(
  boards: BoardRegistry,
  item: Pick<Card, 'board' | 'externalSource' | 'stages'>,
): FactoryRuleBoardClosure | undefined {
  const board = boards.get(boardForWorkItem(item));
  if (!board?.sourceClosed) return undefined;
  const { completed, canceled } = board.sourceClosed;
  return {
    boardTitle: board.name,
    completed: { phase: completed, title: board.phases[completed]!.name },
    canceled: { phase: canceled, title: board.phases[canceled]!.name },
    itemTerminal: item.stages.some(stage => board.isTerminal(stage)),
  };
}

/** Rule-context fragment carrying the card's `boardClosure`, empty when the board declares none. */
export function withBoardClosure(
  boards: BoardRegistry,
  item: Pick<Card, 'board' | 'externalSource' | 'stages'>,
): { boardClosure?: FactoryRuleBoardClosure } {
  const boardClosure = resolveBoardClosure(boards, item);
  return boardClosure ? { boardClosure } : {};
}

/** `{ phase }` for spreading into an integration rule context, or `{}` when the phase is unknown. */
export function rulePhaseField(
  boards: Pick<BoardRegistry, 'get'>,
  item: Pick<Card, 'board' | 'externalSource' | 'stages'>,
): { readonly phase?: FactoryRulePhaseContext } {
  const phase = rulePhaseContext(boards, item);
  return phase ? { phase } : {};
}

/**
 * The change request a review session on this card may publish checks for: the card's own one,
 * or, for an issue card in its board's pull request review phase, the pull request attached to it.
 */
export function boundChangeRequestNumber(boards: Pick<BoardRegistry, 'get'>, item: Card): string | undefined {
  const source = workItemBranchSource(item.externalSource);
  const own = isPullRequestCard({ source });
  if (!own && (item.stages.length !== 1 || cardBoardFlow(boards, item).pullRequestReview !== item.stages[0])) {
    return undefined;
  }
  const number = reviewedChangeRequest({ ...item, source })?.number;
  if (number !== undefined) return String(number);
  // A GitHub key ends in its number (`github-pr:34`); a GitLab key is encoded, so its digits mean nothing.
  return source === 'github-pr' ? /(\d+)$/.exec(item.externalSource?.externalId ?? '')?.[1] : undefined;
}
