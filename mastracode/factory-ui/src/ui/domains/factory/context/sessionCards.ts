import { listWorkItems } from '../services/workItems';
import type { BoardSnapshot } from '../services/workItems';

export interface NamedChanges {
  cards: Set<string>;
  sessions: Set<string>;
}

/** Past these, one reread of the whole list costs less than reading what the frames named. */
const MOST_NAMED_CARDS = 100;
const MOST_NAMED_SESSIONS = 10;

export function fitsNarrowRead(named: NamedChanges): boolean {
  return named.cards.size <= MOST_NAMED_CARDS && named.sessions.size <= MOST_NAMED_SESSIONS;
}

/** The named cards the session list holds, with the cards related to them, and the cards of each named session. */
export async function readNamedSessionCards(
  baseUrl: string,
  factoryProjectId: string,
  named: NamedChanges,
  signal: AbortSignal,
): Promise<BoardSnapshot> {
  const answers = await Promise.all([
    ...(named.cards.size > 0
      ? [listWorkItems(baseUrl, factoryProjectId, signal, { workItemId: [...named.cards], scope: 'sessions' })]
      : []),
    ...[...named.sessions].map(sessionId => listWorkItems(baseUrl, factoryProjectId, signal, { sessionId })),
  ]);
  return {
    workItems: [...new Map(answers.flatMap(answer => answer.workItems).map(card => [card.id, card])).values()],
    runningSessionIds: [...new Set(answers.flatMap(answer => answer.runningSessionIds))],
    parkedSessionIds: [...new Set(answers.flatMap(answer => answer.parkedSessionIds))],
  };
}

/**
 * The session list with what a narrow read answered: its cards replace the ones held or join the
 * list, a named card it left out leaves the list, and every session on its cards runs or parks as
 * it says.
 */
export function withNamedSessionCards(list: BoardSnapshot, read: BoardSnapshot, named: NamedChanges): BoardSnapshot {
  const fresh = new Map(read.workItems.map(card => [card.id, card]));
  const held = new Set(list.workItems.map(card => card.id));
  const kept = list.workItems.flatMap(card => {
    const answered = fresh.get(card.id);
    if (answered) return [answered];
    return named.cards.has(card.id) ? [] : [card];
  });
  const answeredSessions = new Set([
    ...named.sessions,
    ...read.workItems.flatMap(card => Object.values(card.sessions).map(ref => ref.sessionId)),
  ]);
  const settled = (before: string[], now: string[]) => [...before.filter(id => !answeredSessions.has(id)), ...now];
  return {
    ...list,
    workItems: [...kept, ...read.workItems.filter(card => !held.has(card.id))],
    runningSessionIds: settled(list.runningSessionIds, read.runningSessionIds),
    parkedSessionIds: settled(list.parkedSessionIds, read.parkedSessionIds),
  };
}
