import type { FactoryRuleBoardClosure, FactoryRulePhaseContext } from '../rules/types.js';
import type { Card } from '../storage/domains/work-items/base.js';
import type { WorkItemSourceRow } from '../storage/domains/work-items/work-item-schema.js';
import type {
  BoardEventIntegration,
  BoardEventRules,
  BoardPhaseKind,
  BoardToolResultRuleHandler,
} from './define-board.js';
import type { BoardRegistry } from './registry.js';

export interface PhaseSemantics {
  readonly kind: BoardPhaseKind;
  /** Seat that carries a working phase; absent for resting and terminal phases. */
  readonly role?: string;
}

/**
 * Board that owns a work item. Rows created before boards were persisted carry no `board`;
 * they belong to Work. (Pull requests used to default to the retired Review board; storage
 * now reads those rows as Work.)
 */
export function boardForWorkItem(item: Pick<Card, 'board'>): string {
  return item.board ?? 'work';
}

/** The Work phase where a card's pull or merge request gets its independent review. */
export const PULL_REQUEST_REVIEW_PHASE = 'pr-review';

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

/** Whether the rule's card carries the change request the reviewer reviews. */
export function reviewsPullRequest(context: {
  readonly board?: string;
  readonly item?: SourcedItem & { readonly source: string };
}): boolean {
  return context.board === 'work' && context.item !== undefined && hasPullRequest(context.item);
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
    outcomes: Object.freeze(Object.keys(phase?.outcomes ?? {})),
  });
}

/**
 * Whether a persisted card has finished, judged by the board it sits on: the installed
 * board's phase kind first, then the built-in Work names for rows whose board is
 * not installed. Unknown boards or phases are never terminal, so a card is only ever
 * released from ownership on the board's own say-so.
 */
export function isTerminalWorkItem(
  boards: BoardRegistry,
  item: Pick<Card, 'board' | 'externalSource' | 'stages'>,
): boolean {
  const semantics = workItemPhaseSemantics(boards, item);
  if (semantics) return semantics.kind === 'terminal';
  if (boardForWorkItem(item) !== 'work') return false;
  const stage = item.stages.length === 1 ? item.stages[0] : undefined;
  return stage === 'done' || stage === 'canceled';
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
