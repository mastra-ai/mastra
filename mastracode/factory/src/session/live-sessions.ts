import type { AgentControllerEvent } from '@mastra/core/agent-controller';

/** The slice of a live session this registry needs: its id, its run, its parked tools, and who it works for. */
export interface LiveSession {
  readonly identity: { getId(): string };
  readonly run: { isRunning(): boolean };
  readonly state: { get(): Readonly<{ factoryOrgId?: string; factoryProjectId?: string }> };
  readonly displayState: { get(): { pendingSuspensions: ReadonlyMap<string, { toolName: string }> } };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

interface SessionNotifier {
  onSessionCreated(listener: (session: LiveSession) => void): () => void;
  onSessionDeleted(listener: (session: LiveSession) => void): () => void;
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
 * The sessions this process has materialized, by session id.
 *
 * Membership comes from the controller's notifications rather than
 * `getSessionByResource`, which hands back the pending creation — awaiting it
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
  readonly #parkedListeners = new Set<(session: LiveSession) => void>();

  constructor(controller: SessionNotifier) {
    controller.onSessionCreated(session => this.#track(session));
    controller.onSessionDeleted(session => {
      const id = session.identity.getId();
      this.#byId.get(id)?.unsubscribe();
      this.#byId.delete(id);
    });
  }

  #track(session: LiveSession): void {
    const suspendedAt = new Map<string, number>();
    const unsubscribe = session.subscribe(event => {
      if (event.type === 'tool_suspended') suspendedAt.set(event.toolCallId, Date.now());
      else if (event.type === 'tool_suspension_cancelled') suspendedAt.delete(event.toolCallId);
      else if (event.type === 'agent_end' && event.reason !== 'suspended') suspendedAt.clear();
      else return;
      for (const listener of this.#parkedListeners) listener(session);
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

  /** Fires when a session parks, is answered, or finishes a turn: whoever shows parked runs re-reads. */
  onParkedChanged(listener: (session: LiveSession) => void): () => void {
    this.#parkedListeners.add(listener);
    return () => this.#parkedListeners.delete(listener);
  }
}
