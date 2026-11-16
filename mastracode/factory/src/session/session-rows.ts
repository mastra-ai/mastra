import { DEFAULT_BOARD_ID } from '../boards/default-board.js';
import type { BoardRegistry } from '../boards/registry.js';
import { boardForWorkItem, isPullRequestCard } from '../boards/semantics.js';
import type { SessionRow } from '../routes/contracts.js';
import { isFactoryPrincipalId } from '../storage/domains/projects/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { isPersonSessionBranch } from '../work-item-branch.js';
import { cardContextSessions, cardThreadSession } from '../work-items/card-context-sessions.js';
import type { ContextPhase } from '../work-items/card-context-sessions.js';
import { cardFacts } from '../work-items/card-facts.js';
import { cardChangeRequest, isSettledChangeRequest } from '../work-items/change-requests.js';
import type { CardChangeRequest } from '../work-items/change-requests.js';
import { relatedCardsIn } from '../work-items/list-related-cards.js';
import { sessionRowStatus } from './session-row-status.js';

export interface RowSession {
  readonly id: string;
  readonly sessionId: string;
  readonly projectRepositoryId: string | null;
  readonly userId: string;
  readonly branch: string;
  readonly title: string | null;
  readonly visibility: 'org' | 'private';
  readonly materializedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly owner?: { readonly id: string; readonly name: string; readonly avatarUrl?: string };
  readonly followedWorkItemIds?: readonly string[];
}

export interface SessionRowFacts {
  sessions: readonly RowSession[];
  cards: readonly Card[];
  boards: BoardRegistry;
  /** Card ids. */
  awaitingPerson: ReadonlySet<string>;
  runningSessionIds: ReadonlySet<string>;
  parkedSessionIds: ReadonlySet<string>;
  viewerUserId: string;
  pinnedSessionIds: ReadonlySet<string>;
  revealChildSessions: boolean;
}

export interface RunReach {
  authEnabled: boolean;
  viewerUserId: string;
  factoryProjectId: string;
  visibleSessionIds: ReadonlySet<string>;
}

type SessionRowFields = Omit<SessionRow, 'childRows'>;
type SessionActivityStatus = SessionRow['status'];

interface CardSession {
  card: Card;
  threadId: string;
  pullRequest: CardChangeRequest | undefined;
}

interface BuiltRow {
  readonly session: RowSession;
  readonly card: Card | undefined;
  readonly row: SessionRowFields;
}

const CARRIED_STATUSES: readonly SessionActivityStatus[] = ['waiting', 'working'];

function changeRequestOf(card: Card): CardChangeRequest | undefined {
  return cardChangeRequest({
    ...card,
    source: cardFacts(card).source,
    url: card.workItem.url ?? card.externalSource?.url,
  });
}

function cardSessionIndex(cards: readonly Card[]): ReadonlyMap<string, CardSession> {
  const relatedTo = relatedCardsIn(cards);
  const pullRequestFor = (card: Card): CardChangeRequest | undefined => {
    const own = changeRequestOf(card);
    if (own) return own;
    const latest = relatedTo(card)
      .filter(related => isPullRequestCard({ source: cardFacts(related).source }))
      .toSorted((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    return latest && changeRequestOf(latest);
  };

  return new Map(
    cards.flatMap(card => {
      // A legacy `plan` key may share its session with `work`; the current key names it.
      const sessionRefs = Object.entries(card.sessions).toSorted(
        ([a], [b]) => Number(a === 'plan') - Number(b === 'plan'),
      );
      if (sessionRefs.length === 0) return [];
      const pullRequest = pullRequestFor(card);
      const seen = new Set<string>();
      return sessionRefs.flatMap(([, ref]) => {
        if (seen.has(ref.sessionId)) return [];
        seen.add(ref.sessionId);
        return [[ref.sessionId, { card, threadId: ref.threadId, pullRequest }] as const];
      });
    }),
  );
}

function contextPhases(boards: BoardRegistry, card: Card): ContextPhase[] | undefined {
  const board = boards.get(boardForWorkItem(card));
  if (!board) return undefined;
  return Object.entries(board.phases).map(([id, phase]) => ({
    id,
    title: phase.name,
    name: phase.name,
    ...(phase.kind === 'working' ? { context: phase.runner.context } : {}),
  }));
}

function activityStatus(input: {
  initializing: boolean;
  running: boolean;
  attention: boolean;
  settled: boolean;
}): SessionActivityStatus {
  const marker = sessionRowStatus(input);
  if (marker === 'ready') return 'waiting';
  return marker ?? (input.settled ? 'done' : 'idle');
}

function wireSession(session: RowSession): SessionRowFields['session'] {
  const { owner } = session;
  return {
    id: session.id,
    sessionId: session.sessionId,
    projectRepositoryId: session.projectRepositoryId,
    userId: session.userId,
    branch: session.branch,
    title: session.title,
    visibility: session.visibility,
    createdAt: session.createdAt.toISOString(),
    ...(owner
      ? {
          owner: {
            id: owner.id,
            name: owner.name,
            ...(owner.avatarUrl !== undefined ? { avatarUrl: owner.avatarUrl } : {}),
          },
        }
      : {}),
  };
}

function cardFields(indexed: CardSession | undefined): Pick<SessionRowFields, 'card' | 'pullRequest'> {
  if (!indexed) return {};
  const { card, pullRequest } = indexed;
  const source = card.externalSource;
  return {
    card: {
      id: card.id,
      title: card.workItem.title,
      workItemUrl: card.workItem.url,
      externalSource: source && {
        integrationId: source.integrationId,
        type: source.type,
        externalId: source.externalId,
        ...(source.workspaceId !== undefined ? { workspaceId: source.workspaceId } : {}),
        ...(source.url !== undefined ? { url: source.url } : {}),
      },
    },
    ...(pullRequest ? { pullRequest } : {}),
  };
}

function factoryRow(session: RowSession, indexed: CardSession | undefined, facts: SessionRowFacts): BuiltRow {
  const card = indexed?.card;
  const board = card && facts.boards.get(boardForWorkItem(card));
  const settled =
    card?.stages.some(stage => board?.isTerminal(stage) === true) === true ||
    isSettledChangeRequest(indexed?.pullRequest?.status);
  return {
    session,
    card,
    row: {
      session: wireSession(session),
      origin: 'factory',
      board: card ? boardForWorkItem(card) : DEFAULT_BOARD_ID,
      status: activityStatus({
        initializing: session.materializedAt === null,
        running: facts.runningSessionIds.has(session.sessionId),
        attention:
          facts.parkedSessionIds.has(session.sessionId) || (card !== undefined && facts.awaitingPerson.has(card.id)),
        settled,
      }),
      pinned: facts.pinnedSessionIds.has(session.sessionId),
      updatedAt: (card?.updatedAt ?? session.updatedAt).toISOString(),
      ...cardFields(indexed),
      ...(indexed ? { itemId: indexed.card.id, threadId: indexed.threadId } : {}),
    },
  };
}

function userRow(session: RowSession, indexed: CardSession | undefined, facts: SessionRowFacts): BuiltRow {
  return {
    session,
    card: indexed?.card,
    row: {
      session: wireSession(session),
      origin: 'user',
      status: activityStatus({
        initializing: session.materializedAt === null,
        running: facts.runningSessionIds.has(session.sessionId),
        attention: false,
        settled: false,
      }),
      pinned: facts.pinnedSessionIds.has(session.sessionId),
      updatedAt: session.updatedAt.toISOString(),
      ...cardFields(indexed),
    },
  };
}

function orderCardRows(cardRows: readonly BuiltRow[], boards: BoardRegistry): SessionRowFields[] {
  const card = cardRows[0]?.card;
  if (!card) return cardRows.map(({ row }) => row);
  const phases = contextPhases(boards, card);
  const stage = card.stages[0] ?? '';
  const opened = cardThreadSession(card, phases, stage)?.sessionId;
  const sessions = cardContextSessions(card, phases, stage);
  const rank = ({ row }: BuiltRow) => {
    if (row.session.sessionId === opened) return -1;
    const index = sessions.findIndex(entry => entry.ref.sessionId === row.session.sessionId);
    return index === -1 ? sessions.length : index;
  };
  return cardRows
    .toSorted((a, b) => rank(a) - rank(b))
    .map(({ row }, index) => {
      const phaseLabel =
        index === 0 ? undefined : sessions.find(entry => entry.ref.sessionId === row.session.sessionId)?.label;
      return phaseLabel === undefined ? row : { ...row, phaseLabel };
    });
}

function oneRowPerCard(rows: readonly BuiltRow[], facts: SessionRowFacts): SessionRow[] {
  const rowsByCard = new Map<string, BuiltRow[]>();
  for (const built of rows) {
    const { itemId } = built.row;
    if (itemId === undefined) continue;
    const cardRows = rowsByCard.get(itemId);
    if (cardRows) cardRows.push(built);
    else rowsByCard.set(itemId, [built]);
  }
  return rows.flatMap(built => {
    const { itemId } = built.row;
    const cardRows = itemId === undefined ? undefined : rowsByCard.get(itemId);
    if (!cardRows || cardRows.length === 1) return [built.row];
    const [shown, ...others] = orderCardRows(cardRows, facts.boards);
    if (shown?.session.sessionId !== built.row.session.sessionId) return [];
    const carried = CARRIED_STATUSES.find(status => cardRows.some(candidate => candidate.row.status === status));
    if (facts.revealChildSessions) return [{ ...shown, cardStatus: carried ?? shown.status, childRows: others }];
    return [
      {
        ...shown,
        pinned: cardRows.some(candidate => candidate.row.pinned),
        cardSessionIds: cardRows.map(candidate => candidate.row.session.sessionId),
        status: carried ?? shown.status,
      },
    ];
  });
}

function linkFollowedCards(
  rows: readonly BuiltRow[],
  cardRows: readonly BuiltRow[],
  facts: SessionRowFacts,
): SessionRow[] {
  const viewerFollows = new Set(
    rows.flatMap(({ session }) => (session.userId === facts.viewerUserId ? (session.followedWorkItemIds ?? []) : [])),
  );
  const waitsOnViewer = ({ row }: BuiltRow) =>
    facts.parkedSessionIds.has(row.session.sessionId) && row.itemId !== undefined && viewerFollows.has(row.itemId);
  return rows.map(({ session, row }) => {
    const followed = new Set(session.followedWorkItemIds);
    if (followed.size === 0) return row;
    const linked = cardRows.filter(
      cardRow =>
        cardRow.row.itemId !== undefined &&
        followed.has(cardRow.row.itemId) &&
        cardRow.row.session.sessionId !== session.sessionId,
    );
    if (linked.length === 0) return row;
    const waiting = linked.find(waitsOnViewer);
    return {
      ...row,
      ...(waiting ? { status: 'waiting' as const, waitingSessionId: waiting.row.session.sessionId } : {}),
      ...(facts.revealChildSessions
        ? {
            childRows: linked.map(cardRow => ({
              ...cardRow.row,
              ...(waitsOnViewer(cardRow) ? { waitingSessionId: cardRow.row.session.sessionId } : {}),
              ...(isFactoryPrincipalId(cardRow.session.userId) ? { runByFactory: true as const } : {}),
            })),
          }
        : {}),
    };
  });
}

/** Dates as ISO strings. */
export function sessionRows(facts: SessionRowFacts): SessionRow[] {
  const cardSessionOf = cardSessionIndex(facts.cards);
  const factoryRows = facts.sessions.flatMap(session =>
    isPersonSessionBranch(session.branch) ? [] : [factoryRow(session, cardSessionOf.get(session.sessionId), facts)],
  );
  const userRows = facts.sessions.flatMap(session =>
    isPersonSessionBranch(session.branch) ? [userRow(session, cardSessionOf.get(session.sessionId), facts)] : [],
  );
  return [...oneRowPerCard(factoryRows, facts), ...linkFollowedCards(userRows, factoryRows, facts)];
}

// A run predating shared resources also ran under its session id as resource.
export function runningSessionIds(
  runs: readonly { threadId: string; resourceId?: string }[],
  reach: RunReach,
): Set<string> {
  const reachable = (resourceId: string) =>
    !reach.authEnabled ||
    resourceId === reach.viewerUserId ||
    resourceId === reach.factoryProjectId ||
    reach.visibleSessionIds.has(resourceId);
  return new Set(
    runs.flatMap(run => {
      if (run.resourceId === undefined) return [run.threadId];
      return reachable(run.resourceId) ? [run.threadId, run.resourceId] : [];
    }),
  );
}
