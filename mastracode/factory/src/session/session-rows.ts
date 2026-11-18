import { DEFAULT_BOARD_ID } from '../boards/default-board.js';
import type { BoardRegistry } from '../boards/registry.js';
import { boardForWorkItem } from '../boards/semantics.js';
import type { SessionRow } from '../routes/contracts.js';
import { isFactoryPrincipalId } from '../storage/domains/projects/base.js';
import { isSeenBy } from '../storage/domains/source-control/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { isPersonSessionBranch } from '../work-item-branch.js';
import { cardContextSessions, cardThreadSession } from '../work-items/card-context-sessions.js';
import type { CardContextSession, ContextPhase } from '../work-items/card-context-sessions.js';
import { cardFacts } from '../work-items/card-facts.js';
import { cardChangeRequest, isPullRequestCard, isSettledChangeRequest } from '../work-items/change-requests.js';
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

export interface SessionStatusViewer {
  viewerUserId: string;
  /** Card ids. */
  awaitingPerson: ReadonlySet<string>;
  runningSessionIds: ReadonlySet<string>;
  parkedSessionIds: ReadonlySet<string>;
}

export interface SessionRowViewer extends SessionStatusViewer {
  pinnedSessionIds: ReadonlySet<string>;
  revealChildSessions: boolean;
}

export interface RunReach {
  authEnabled: boolean;
  viewerUserId: string;
  factoryProjectId: string;
  visibleSessionIds: Pick<ReadonlySet<string>, 'has'>;
  sessionOnThread(threadId: string): string | undefined;
}

type SessionRowFields = Omit<SessionRow, 'childRows'>;
type SessionActivityStatus = SessionRow['status'];

/** A card's status as its sidebar row shows it, and whether one of its sessions holds it. */
export interface CardSessionStatus {
  status: SessionActivityStatus;
  /** One of its sessions is running or parked on a person, so no rival run may start. */
  held: boolean;
}

interface CardSession {
  card: Card;
  threadId: string;
  pullRequest: CardChangeRequest | undefined;
}

interface CardContext {
  opened: string | undefined;
  sessions: readonly CardContextSession[];
}

interface IndexedSession {
  readonly session: RowSession;
  readonly person: boolean;
  readonly wire: SessionRowFields['session'];
  readonly card: Card | undefined;
  readonly board: string;
  readonly settled: boolean;
  readonly updatedAt: string;
  readonly cardFields: Pick<SessionRowFields, 'card' | 'pullRequest' | 'itemId' | 'threadId'>;
  readonly cardRank: number;
  readonly phaseLabel: string | undefined;
  readonly followedWorkItemIds: readonly string[];
}

interface BuiltRow {
  readonly entry: IndexedSession;
  readonly row: SessionRowFields;
}

const CARRIED_STATUSES: readonly SessionActivityStatus[] = ['waiting', 'working'];
const NO_CARDS: ReadonlySet<string> = new Set();

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

function cardContext(boards: BoardRegistry, card: Card): CardContext {
  const phases = contextPhases(boards, card);
  const stage = card.stages[0] ?? '';
  return {
    opened: cardThreadSession(card, phases, stage)?.sessionId,
    sessions: cardContextSessions(card, phases, stage),
  };
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

function indexSession(
  session: RowSession,
  indexed: CardSession | undefined,
  boards: BoardRegistry,
  contextOf: (card: Card) => CardContext,
): IndexedSession {
  const person = isPersonSessionBranch(session.branch);
  const card = indexed?.card;
  const board = card && boards.get(boardForWorkItem(card));
  const context = card && !person ? contextOf(card) : undefined;
  const contextIndex = context?.sessions.findIndex(entry => entry.ref.sessionId === session.sessionId) ?? -1;
  return {
    session,
    person,
    wire: wireSession(session),
    card,
    board: card ? boardForWorkItem(card) : DEFAULT_BOARD_ID,
    settled:
      card?.stages.some(stage => board?.isTerminal(stage) === true) === true ||
      isSettledChangeRequest(indexed?.pullRequest?.status),
    updatedAt: (person ? session.updatedAt : (card?.updatedAt ?? session.updatedAt)).toISOString(),
    cardFields: {
      ...cardFields(indexed),
      ...(indexed && !person ? { itemId: indexed.card.id, threadId: indexed.threadId } : {}),
    },
    cardRank:
      session.sessionId === context?.opened ? -1 : contextIndex === -1 ? (context?.sessions.length ?? 0) : contextIndex,
    phaseLabel: context?.sessions[contextIndex]?.label,
    followedWorkItemIds: [...new Set(session.followedWorkItemIds)],
  };
}

function sessionStatus(entry: IndexedSession, viewer: SessionStatusViewer): SessionActivityStatus {
  const { session, card, person } = entry;
  const running = viewer.runningSessionIds.has(session.sessionId);
  return activityStatus({
    initializing: running && session.materializedAt === null,
    running,
    attention:
      viewer.parkedSessionIds.has(session.sessionId) ||
      (!person && card !== undefined && viewer.awaitingPerson.has(card.id)),
    settled: !person && entry.settled,
  });
}

function factoryRow(entry: IndexedSession, viewer: SessionRowViewer): SessionRowFields {
  return {
    session: entry.wire,
    origin: 'factory',
    board: entry.board,
    status: sessionStatus(entry, viewer),
    pinned: viewer.pinnedSessionIds.has(entry.session.sessionId),
    updatedAt: entry.updatedAt,
    ...entry.cardFields,
  };
}

function userRow(entry: IndexedSession, viewer: SessionRowViewer): SessionRowFields {
  const { session } = entry;
  return {
    session: entry.wire,
    origin: 'user',
    status: sessionStatus(entry, viewer),
    pinned: viewer.pinnedSessionIds.has(session.sessionId),
    updatedAt: entry.updatedAt,
    ...entry.cardFields,
  };
}

function rowsByCard<T extends { readonly entry: IndexedSession }>(
  rows: readonly T[],
): ReadonlyMap<string, readonly T[]> {
  const byCard = new Map<string, T[]>();
  for (const built of rows) {
    const { itemId } = built.entry.cardFields;
    if (itemId === undefined) continue;
    const cardRows = byCard.get(itemId);
    if (cardRows) cardRows.push(built);
    else byCard.set(itemId, [built]);
  }
  return byCard;
}

function cardStatus(lead: SessionActivityStatus, statuses: readonly SessionActivityStatus[]): SessionActivityStatus {
  return CARRIED_STATUSES.find(status => statuses.includes(status)) ?? lead;
}

function cardRow(cardRows: readonly BuiltRow[], viewer: SessionRowViewer): { lead: BuiltRow; row: SessionRow } {
  const ordered = cardRows.toSorted((a, b) => a.entry.cardRank - b.entry.cardRank);
  const [shown, ...others] = ordered.map(({ entry, row }, index) =>
    index === 0 || entry.phaseLabel === undefined ? row : { ...row, phaseLabel: entry.phaseLabel },
  );
  const lead = ordered[0];
  if (!shown || !lead) throw new Error('A card row needs at least one session');
  const status = cardStatus(
    shown.status,
    cardRows.map(candidate => candidate.row.status),
  );
  if (viewer.revealChildSessions) {
    return { lead, row: { ...shown, cardStatus: status, childRows: others } };
  }
  return {
    lead,
    row: {
      ...shown,
      pinned: cardRows.some(candidate => candidate.row.pinned),
      cardSessionIds: cardRows.map(candidate => candidate.row.session.sessionId),
      status,
    },
  };
}

function oneRowPerCard(
  rows: readonly BuiltRow[],
  byCard: ReadonlyMap<string, readonly BuiltRow[]>,
  viewer: SessionRowViewer,
): SessionRow[] {
  const cardRowOf = new Map<BuiltRow, SessionRow>();
  for (const cardRows of byCard.values()) {
    if (cardRows.length === 1) continue;
    const { lead, row } = cardRow(cardRows, viewer);
    cardRowOf.set(lead, row);
  }
  return rows.flatMap(built => {
    const { itemId } = built.row;
    const cardRows = itemId === undefined ? undefined : byCard.get(itemId);
    if (!cardRows || cardRows.length === 1) return [built.row];
    const row = cardRowOf.get(built);
    return row ? [row] : [];
  });
}

function linkFollowedCards(
  rows: readonly BuiltRow[],
  byCard: ReadonlyMap<string, readonly BuiltRow[]>,
  viewer: SessionRowViewer,
): SessionRow[] {
  const viewerFollows = new Set(
    rows.flatMap(({ entry }) => (entry.session.userId === viewer.viewerUserId ? entry.followedWorkItemIds : [])),
  );
  const waitsOnViewer = ({ row }: BuiltRow) =>
    viewer.parkedSessionIds.has(row.session.sessionId) && row.itemId !== undefined && viewerFollows.has(row.itemId);
  return rows.map(({ entry, row }) => {
    const linked = entry.followedWorkItemIds
      .flatMap(itemId => byCard.get(itemId) ?? [])
      .filter(cardRow => cardRow.row.session.sessionId !== entry.session.sessionId);
    if (linked.length === 0) return row;
    const waiting = linked.find(waitsOnViewer);
    return {
      ...row,
      ...(waiting ? { status: 'waiting' as const, waitingSessionId: waiting.row.session.sessionId } : {}),
      ...(viewer.revealChildSessions
        ? {
            childRows: linked.map(cardRow => ({
              ...cardRow.row,
              ...(waitsOnViewer(cardRow) ? { waitingSessionId: cardRow.row.session.sessionId } : {}),
              ...(isFactoryPrincipalId(cardRow.entry.session.userId) ? { runByFactory: true as const } : {}),
            })),
          }
        : {}),
    };
  });
}

export class SessionRowIndex {
  readonly #sessions: readonly IndexedSession[];

  constructor(sessions: readonly RowSession[], cards: readonly Card[], boards: BoardRegistry) {
    const cardSessionOf = cardSessionIndex(cards);
    const contexts = new Map<Card, CardContext>();
    const contextOf = (card: Card) => {
      let context = contexts.get(card);
      if (!context) contexts.set(card, (context = cardContext(boards, card)));
      return context;
    };
    this.#sessions = sessions.map(session =>
      indexSession(session, cardSessionOf.get(session.sessionId), boards, contextOf),
    );
  }

  rows(viewer: SessionRowViewer): SessionRow[] {
    const factoryRows: BuiltRow[] = [];
    const userRows: BuiltRow[] = [];
    for (const entry of this.#sessions) {
      if (!isSeenBy(entry.session, viewer.viewerUserId)) continue;
      if (entry.person) userRows.push({ entry, row: userRow(entry, viewer) });
      else factoryRows.push({ entry, row: factoryRow(entry, viewer) });
    }
    const byCard = rowsByCard(factoryRows);
    return [...oneRowPerCard(factoryRows, byCard, viewer), ...linkFollowedCards(userRows, byCard, viewer)];
  }

  /** Each card's status as its sidebar row shows it, and whether one of its sessions holds it, by card id. */
  cardStatuses(viewer: SessionStatusViewer): ReadonlyMap<string, CardSessionStatus> {
    const sessionsAlone = { ...viewer, awaitingPerson: NO_CARDS };
    const sessions = this.#sessions.flatMap(entry =>
      entry.person || !isSeenBy(entry.session, viewer.viewerUserId)
        ? []
        : [{ entry, status: sessionStatus(entry, viewer), held: isInFlight(sessionStatus(entry, sessionsAlone)) }],
    );
    return new Map(
      Array.from(rowsByCard(sessions), ([itemId, cardSessions]) => {
        const [lead] = cardSessions.toSorted((a, b) => a.entry.cardRank - b.entry.cardRank);
        if (!lead) throw new Error('A card row needs at least one session');
        return [
          itemId,
          {
            status: cardStatus(
              lead.status,
              cardSessions.map(candidate => candidate.status),
            ),
            held: cardSessions.some(candidate => candidate.held),
          },
        ];
      }),
    );
  }
}

export function isInFlight(status: SessionActivityStatus): boolean {
  return status !== 'idle' && status !== 'done';
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
      if (run.resourceId !== undefined && !reachable(run.resourceId)) return [];
      return [run.threadId, run.resourceId, reach.sessionOnThread(run.threadId)].filter(id => id !== undefined);
    }),
  );
}
