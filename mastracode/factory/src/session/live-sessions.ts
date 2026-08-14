/** The slice of a live session this registry needs: its id, and whether it is running. */
export interface LiveSession {
  readonly identity: { getId(): string };
  readonly run: { isRunning(): boolean };
}

interface SessionNotifier {
  onSessionCreated(listener: (session: LiveSession) => void): () => void;
  onSessionDeleted(listener: (session: LiveSession) => void): () => void;
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
 * Whether a session is *running* is read from the session itself, never
 * tracked here: no missed run event can leave the answer stuck.
 */
export class LiveSessions {
  readonly #byId = new Map<string, LiveSession>();

  constructor(controller: SessionNotifier) {
    controller.onSessionCreated(session => this.#byId.set(session.identity.getId(), session));
    controller.onSessionDeleted(session => this.#byId.delete(session.identity.getId()));
  }

  /** Whether the session has an agent run in flight right now. */
  isRunning(sessionId: string): boolean {
    return this.#byId.get(sessionId)?.run.isRunning() ?? false;
  }
}
