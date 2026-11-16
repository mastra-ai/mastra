import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import type { PubSub } from '@mastra/core/events';

import { touchFeed } from '../feed-events.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';

/** The slice of a live session this registry needs: its id, its run, its parked tools, and who it works for. */
export interface LiveSession {
  readonly identity: { getId(): string };
  readonly run: { isRunning(): boolean };
  readonly state: { get(): Readonly<{ factoryOrgId?: string; factoryProjectId?: string }> };
  readonly displayState: { get(): { pendingSuspensions: ReadonlyMap<string, { toolName: string }> } };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

export interface SessionNotifier {
  onSessionCreated(listener: (session: LiveSession) => void): () => void;
  onSessionDeleted(listener: (session: LiveSession) => void): () => void;
}

/** Where a session's Factory is written down for good: its live state can lose it, its row cannot. */
export interface SessionRows {
  getBySessionId(sessionId: string): Promise<Pick<SourceControlSession, 'orgId' | 'factoryProjectId'> | null>;
}

/** The tool a session has waited on longest, and since when (epoch ms). */
export interface ParkedRun {
  toolName: string;
  suspendedAt: number;
}

interface TrackedSession {
  session: LiveSession;
  seenAt: number;
  suspendedAt: Map<string, number>;
  unsubscribe: () => void;
}

/**
 * Events after which the controller may list different runs for a session, beyond the parking ones.
 * Leaving a thread drops the run the session started on it, and no `agent_end` reaches a session that has left.
 */
const RUN_MAY_HAVE_CHANGED = new Set<AgentControllerEvent['type']>([
  'agent_start',
  'thread_changed',
  'thread_created',
  'thread_deleted',
]);

/**
 * The sessions this process has materialized, by session id.
 *
 * Membership comes from the controller's notifications rather than
 * `getSession`, which hands back the pending creation — awaiting it
 * from a request blocks for as long as the session takes to materialize its
 * sandbox, minutes on a cold clone. Notifications only fire once a session
 * exists, so a read never waits.
 *
 * Whether a session is *running* or *parked* is read from the session itself,
 * never tracked here: no missed run event can leave the answer stuck. Only the
 * moment each suspension arrived is kept, since the session does not date them.
 */
export class LiveSessions {
  readonly #byId = new Map<string, TrackedSession>();
  readonly #runListeners = new Set<(session: LiveSession) => void>();
  /** A park stamp doubles as the receipt key, so two suspensions in one millisecond must not share one. */
  #lastParkStamp = 0;

  constructor(controller: SessionNotifier) {
    controller.onSessionCreated(session => this.#track(session));
    controller.onSessionDeleted(session => {
      const id = session.identity.getId();
      this.#byId.get(id)?.unsubscribe();
      this.#byId.delete(id);
      // The controller resets the run before it reports the deletion, so the session can no longer say a board showed it.
      for (const listener of this.#runListeners) listener(session);
    });
  }

  #nextParkStamp(): number {
    this.#lastParkStamp = Math.max(Date.now(), this.#lastParkStamp + 1);
    return this.#lastParkStamp;
  }

  #track(session: LiveSession): void {
    const suspendedAt = new Map<string, number>();
    const unsubscribe = session.subscribe(event => {
      if (event.type === 'tool_suspended') suspendedAt.set(event.toolCallId, this.#nextParkStamp());
      else if (event.type === 'tool_suspension_cancelled') suspendedAt.delete(event.toolCallId);
      else if (event.type === 'agent_end' && event.reason !== 'suspended') suspendedAt.clear();
      else if (!RUN_MAY_HAVE_CHANGED.has(event.type)) return;
      for (const listener of this.#runListeners) listener(session);
    });
    this.#byId.set(session.identity.getId(), { session, seenAt: Date.now(), suspendedAt, unsubscribe });
  }

  /** Whether the session has an agent run in flight right now. */
  isRunning(sessionId: string): boolean {
    return this.#byId.get(sessionId)?.session.run.isRunning() ?? false;
  }

  /** The tool the session is parked on, oldest first, or nothing when no answer is owed. */
  parked(sessionId: string): ParkedRun | undefined {
    const tracked = this.#byId.get(sessionId);
    if (!tracked) return undefined;
    let oldest: ParkedRun | undefined;
    for (const [toolCallId, { toolName }] of tracked.session.displayState.get().pendingSuspensions) {
      const suspendedAt = tracked.suspendedAt.get(toolCallId) ?? tracked.seenAt;
      if (!oldest || suspendedAt < oldest.suspendedAt) oldest = { toolName, suspendedAt };
    }
    return oldest;
  }

  /** Every parked session of a project, so the inbox reads no card when nothing waits. */
  parkedIn(factoryProjectId: string): Array<{ sessionId: string; run: ParkedRun }> {
    const parked: Array<{ sessionId: string; run: ParkedRun }> = [];
    for (const [sessionId, tracked] of this.#byId) {
      if (tracked.session.state.get().factoryProjectId !== factoryProjectId) continue;
      const run = this.parked(sessionId);
      if (run) parked.push({ sessionId, run });
    }
    return parked;
  }

  /** Fires when a session starts a run, parks, is answered, finishes a turn, or leaves its thread: whoever shows runs re-reads. */
  onRunChanged(listener: (session: LiveSession) => void): () => void {
    this.#runListeners.add(listener);
    return () => this.#runListeners.delete(listener);
  }
}

/** A run starting, parking, being answered or ending changes what boards show, so the registry bumps the project's feed. */
export function liveSessionsTouchingTheFeed(
  controller: SessionNotifier,
  eventBus: PubSub,
  rows: SessionRows,
): LiveSessions {
  const liveSessions = new LiveSessions(controller);
  liveSessions.onRunChanged(session => {
    const { factoryOrgId, factoryProjectId } = session.state.get();
    if (factoryOrgId && factoryProjectId) {
      touchFeed(eventBus, { orgId: factoryOrgId, factoryProjectId });
      return;
    }
    // Only a Factory run carries its project in state, and a recovered one can come back without it: its row names it.
    rows
      .getBySessionId(session.identity.getId())
      .then(row => {
        if (row?.factoryProjectId) touchFeed(eventBus, { orgId: row.orgId, factoryProjectId: row.factoryProjectId });
      })
      .catch(error => console.warn('[factory] Unable to find the board of a session run.', error));
  });
  return liveSessions;
}
