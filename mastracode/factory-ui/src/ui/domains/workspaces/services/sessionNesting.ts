import type { SessionListRow } from './sessionRows';

export interface NestedSessionRows {
  /** Rows listed at the top level: every row whose origin session is not listed too. */
  rows: SessionListRow[];
  /** Side sessions listed under each origin session id, in input order. */
  sideSessions: ReadonlyMap<string, readonly SessionListRow[]>;
}

/**
 * Moves each side session (started with `factory_start_session`) under its origin session.
 * A side session whose origin is not in `rows` — filtered out, or not visible to the viewer —
 * stays at the top level so it is never hidden.
 */
export function nestSideSessions(rows: readonly SessionListRow[]): NestedSessionRows {
  const listed = new Set(rows.map(row => row.session.sessionId));
  const sideSessions = new Map<string, SessionListRow[]>();
  const topLevel: SessionListRow[] = [];
  for (const row of rows) {
    const originSessionId = row.session.originSessionId;
    if (originSessionId && originSessionId !== row.session.sessionId && listed.has(originSessionId)) {
      const siblings = sideSessions.get(originSessionId);
      if (siblings) siblings.push(row);
      else sideSessions.set(originSessionId, [row]);
    } else {
      topLevel.push(row);
    }
  }
  return { rows: topLevel, sideSessions };
}

/** Every side session nested anywhere under `row`, depth first. */
export function sideSessionDescendants(
  row: SessionListRow,
  sideSessions: NestedSessionRows['sideSessions'],
): SessionListRow[] {
  return (sideSessions.get(row.session.sessionId) ?? []).flatMap(child => [
    child,
    ...sideSessionDescendants(child, sideSessions),
  ]);
}
