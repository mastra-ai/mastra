import { cardContextSessions } from '@mastra/factory/work-items/card-context-sessions';
import type { CardContextSession } from '@mastra/factory/work-items/card-context-sessions';
import { workItemNumber } from '@mastra/factory/work-items/card-number';
import { matchesSearch, searchableCard } from '@mastra/factory/work-items/search-terms';
import type { SearchableCard, SearchTerm } from '@mastra/factory/work-items/search-terms';

import { boardOf } from '../../factory/boardFlow';
import type { BoardInfo } from '../../factory/boardFlow';
import type { WorkspacesData } from '../../../../hooks/useWorkspaces';
import { currentItemStageLabel } from '../../factory/boardStages';
import { CARD_SOURCES } from '../../factory/cardSources';
import { relationshipLabel, relationshipPath, workItemIdentifier } from '../../factory/services/relationships';
import type { WorkItem, WorkItemSessionRef } from '../../factory/services/workItems';
import { threadPath } from '../../workspaces/services/factoryPaths';
import type { FactoryUserSession } from '../../workspaces/services/user-sessions';
import {
  getFactorySessionKind,
  getReviewBranchIdentifier,
  getUserSessionLabel,
  isAutomaticUserSessionBranch,
} from '../../workspaces/services/sessionPresentation';

export interface SessionSearchResult {
  id: string;
  kind: 'work-session' | 'review-session' | 'user-session';
  title: string;
  context: readonly string[];
  identifier?: string;
  /** The row's own words, which the palette's filter reads; see {@link matchingResults}. */
  value: string;
  /** What the shared search reads of the row: its card's, and its own words. */
  search: SearchableCard;
  path: string;
  preserveOrigin: boolean;
  updatedAt: string;
}

/** A board entry nobody has started yet. */
export interface WorkItemSearchResult {
  id: string;
  title: string;
  context: readonly string[];
  identifier?: string;
  /** The row's own words, which the palette's filter reads; see {@link matchingResults}. */
  value: string;
  /** What the shared search reads of the row: its card's, and its own words. */
  search: SearchableCard;
  path: string;
  updatedAt: string;
  item: WorkItem;
}

interface SessionWorkItem {
  item: WorkItem;
  /** The context the card holds this session under, so sessions on one card read apart. */
  session: CardContextSession<WorkItemSessionRef>;
}

function joinValue(parts: (string | undefined | null)[]): string {
  return parts.filter(part => part !== undefined && part !== null).join(' ');
}

// A card's search, once per card object: the query cache hands the same object back until the card changes.
const searchByCard = new WeakMap<WorkItem, SearchableCard>();

/** What the server's search reads of the card (`cardSearch` in `@mastra/factory`), from the card the browser holds. */
function cardSearch(item: WorkItem): SearchableCard {
  let search = searchByCard.get(item);
  if (!search) {
    search = searchableCard({
      id: item.id,
      title: item.title,
      number: workItemNumber(item),
      sourceId: item.sourceKey,
      key: item.workItem?.key,
      urls: [item.url, item.workItem?.url],
      sources: item.workItem?.sources ?? [],
      sessions: item.sessions,
    });
    searchByCard.set(item, search);
  }
  return search;
}

/** What the shared search reads of a row: its card's search, plus the row's own words (its branch, its kind, its phase). */
function rowSearch(item: WorkItem | undefined, value: string): SearchableCard {
  const own = value.toLowerCase();
  if (item === undefined) return { text: own, ids: [], sourceKeys: [], links: [] };
  const card = cardSearch(item);
  return { ...card, text: `${card.text} ${own}` };
}

/**
 * The rows that answer every typed term, read by the board's own search (`matchesSearch`), each with
 * the typed words added to its `value`. The palette's filter keeps a row whose `value` holds every
 * typed word, so it keeps exactly these: `#12` never keeps `#123`, and a link to any page of a pull
 * request keeps the card it rides on. Render only these.
 */
export function matchingResults<T extends { value: string; search: SearchableCard }>(
  results: readonly T[],
  terms: readonly SearchTerm[],
): readonly T[] {
  if (terms.length === 0) return results;
  const words = terms.map(term => term.word);
  return results
    .filter(result => matchesSearch(result.search, terms))
    .map(result => ({ ...result, value: joinValue([result.value, ...words]) }));
}

function buildValue(
  session: FactoryUserSession,
  kind: SessionSearchResult['kind'],
  title: string,
  identifier: string | undefined,
  item: WorkItem | undefined,
  contextLabel?: string,
): string {
  return joinValue([
    title,
    kind,
    contextLabel,
    session.branch,
    session.baseBranch,
    session.sessionId,
    identifier,
    item?.sourceKey,
    item ? relationshipLabel(item) : undefined,
  ]);
}

function createFactorySessionResult(
  factoryId: string,
  session: FactoryUserSession,
  association: SessionWorkItem | undefined,
): SessionSearchResult {
  const item = association?.item;
  const factoryKind = getFactorySessionKind(session, item);
  const kind: SessionSearchResult['kind'] = factoryKind === 'review' ? 'review-session' : 'work-session';
  const title = item?.title ?? session.branch;
  const contextSession = association?.session;
  // A card holds a session per context on one branch; the context label is what tells them apart.
  const context = contextSession
    ? [contextSession.label, ...(contextSession.current ? ['current'] : []), session.branch]
    : [`${factoryKind === 'review' ? 'Review' : 'Work'} session`, session.branch];
  const threadId = contextSession?.ref.threadId ?? session.sessionId;
  // Work items carry the issue/PR number; when they fail to load the review branch is the only place it survives.
  const identifier = (item ? workItemIdentifier(item) : undefined) ?? getReviewBranchIdentifier(session.branch);
  const value = buildValue(session, kind, title, identifier, item, contextSession?.label);

  return {
    id: session.sessionId,
    kind,
    title,
    context,
    identifier,
    value,
    search: rowSearch(item, value),
    path: threadPath(factoryId, { sessionId: session.sessionId, threadId }),
    preserveOrigin: true,
    updatedAt: item?.updatedAt ?? session.updatedAt,
  };
}

function createUserSessionResult(factoryId: string, session: FactoryUserSession): SessionSearchResult {
  const kind = 'user-session';
  const title = getUserSessionLabel(session);
  const value = buildValue(session, kind, title, undefined, undefined);

  return {
    id: session.sessionId,
    kind,
    title,
    context: isAutomaticUserSessionBranch(session) ? ['User session'] : ['User session', session.branch],
    value,
    search: rowSearch(undefined, value),
    path: `/factories/${factoryId}/user/threads/${session.sessionId}`,
    preserveOrigin: false,
    updatedAt: session.updatedAt,
  };
}

function newestFirst(a: { updatedAt: string }, b: { updatedAt: string }): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

function workItemsBySessionId(
  workItems: WorkItem[],
  boards: readonly BoardInfo[] | undefined,
): Map<string, SessionWorkItem> {
  const bySessionId = new Map<string, SessionWorkItem>();
  for (const item of [...workItems].sort(newestFirst)) {
    const phases = boardOf(boards, item)?.phases;
    for (const session of cardContextSessions(item, phases, item.stages[0] ?? '')) {
      if (!bySessionId.has(session.ref.sessionId)) bySessionId.set(session.ref.sessionId, { item, session });
    }
  }
  return bySessionId;
}

export function createSessionSearchGroups(input: {
  factoryId: string;
  repositories: WorkspacesData[];
  workItems: WorkItem[];
  /** The project's boards, once loaded, so each session reads by the phase it runs. */
  boards?: readonly BoardInfo[];
}): {
  work: SessionSearchResult[];
  review: SessionSearchResult[];
  user: SessionSearchResult[];
} {
  const bySessionId = workItemsBySessionId(input.workItems, input.boards);
  // Sessions on one card share its update time; the one its current phase runs in leads.
  const newestThenCurrent = (a: SessionSearchResult, b: SessionSearchResult) =>
    newestFirst(a, b) ||
    Number(bySessionId.get(b.id)?.session.current ?? false) - Number(bySessionId.get(a.id)?.session.current ?? false);
  const work: SessionSearchResult[] = [];
  const review: SessionSearchResult[] = [];
  const user: SessionSearchResult[] = [];

  for (const repository of input.repositories) {
    for (const session of repository.workspaces) {
      const result = createFactorySessionResult(input.factoryId, session, bySessionId.get(session.sessionId));
      if (result.kind === 'review-session') review.push(result);
      else work.push(result);
    }
    for (const session of repository.userSessions) {
      user.push(createUserSessionResult(input.factoryId, session));
    }
  }

  return {
    work: work.sort(newestThenCurrent),
    review: review.sort(newestThenCurrent),
    user: user.sort(newestFirst),
  };
}

function createWorkItemResult(factoryId: string, item: WorkItem, board: BoardInfo | undefined): WorkItemSearchResult {
  const identifier = workItemIdentifier(item);
  const sourceLabel = CARD_SOURCES[item.source].label;
  const stage = currentItemStageLabel(item, board);
  const number = workItemNumber(item);
  const value = joinValue([
    item.title,
    'work item',
    sourceLabel,
    stage,
    identifier,
    // Not always in the identifier, which leaves out the key of a card filed in Factory itself.
    item.workItem?.key,
    number === null ? undefined : `#${number}`,
    item.sourceKey,
  ]);

  return {
    id: item.id,
    title: item.title,
    context: [sourceLabel, stage, 'not started'],
    identifier,
    value,
    search: rowSearch(item, value),
    path: relationshipPath(item, factoryId),
    updatedAt: item.updatedAt,
    item,
  };
}

/** Board entries with no session to open: the cards nobody has started. */
export function createWorkItemSearchResults(input: {
  factoryId: string;
  /** The cards holding no session. */
  workItems: WorkItem[];
  /** The project's boards, once loaded, so each card's phase reads by its own board's name. */
  boards?: readonly BoardInfo[];
}): WorkItemSearchResult[] {
  return input.workItems
    .map(item => createWorkItemResult(input.factoryId, item, boardOf(input.boards, item)))
    .sort(newestFirst);
}
