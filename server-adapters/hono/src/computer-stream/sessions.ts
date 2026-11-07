import { randomId } from './tickets';
import type { ComputerViewMode } from './tickets';

export const SESSION_IDLE_TTL_MS = 15 * 60_000;
export const SESSION_MAX_LIFETIME_MS = 60 * 60_000;
export const MAX_SESSIONS_PER_COMPUTER = 10;
export const MAX_SESSIONS = 500;

export interface ComputerViewerTarget {
  /** Directory URL of the viewer; used only to derive the upstream `websockify` socket. */
  base: URL;
  /** Upstream-only auth headers; never sent to the browser. */
  headers: Record<string, string>;
}

export interface ComputerSession {
  id: string;
  computerId: string;
  threadId: string;
  resourceId: string;
  mode: ComputerViewMode;
  studioOrigin: string;
  viewer: ComputerViewerTarget;
  /** When `viewer` was last resolved. */
  resolvedAt: number;
  revoked: boolean;
  createdAt: number;
  lastSeen: number;
}

export type NewComputerSession = Omit<ComputerSession, 'id' | 'revoked' | 'createdAt' | 'lastSeen' | 'resolvedAt'>;

/**
 * In-process registry of live viewer sockets, one session per redeemed ticket.
 *
 * Bounded: a computer keeps at most {@link MAX_SESSIONS_PER_COMPUTER} sessions
 * (a new one evicts that computer's oldest) and the process at most
 * {@link MAX_SESSIONS}; a full store rejects instead of evicting another
 * computer's viewer. Sessions expire after {@link SESSION_IDLE_TTL_MS} idle and
 * {@link SESSION_MAX_LIFETIME_MS} absolute.
 */
export class ComputerSessionStore {
  readonly #sessions = new Map<string, ComputerSession>();
  readonly #now: () => number;
  readonly #onRemove?: (session: ComputerSession) => void;

  constructor(options: { now?: () => number; onRemove?: (session: ComputerSession) => void } = {}) {
    this.#now = options.now ?? (() => Date.now());
    this.#onRemove = options.onRemove;
  }

  get size(): number {
    this.#prune();
    return this.#sessions.size;
  }

  /** Would {@link insert} succeed for this computer right now? */
  hasCapacity(computerId: string): boolean {
    this.#prune();
    return this.#sessions.size < MAX_SESSIONS || this.#oldestFor(computerId, MAX_SESSIONS_PER_COMPUTER) !== undefined;
  }

  insert(input: NewComputerSession): ComputerSession | undefined {
    this.#prune();
    const evict = this.#oldestFor(input.computerId, MAX_SESSIONS_PER_COMPUTER);
    if (evict) {
      this.#remove(evict);
    } else if (this.#sessions.size >= MAX_SESSIONS) {
      return undefined;
    }
    const now = this.#now();
    const session: ComputerSession = {
      ...input,
      id: randomId(),
      revoked: false,
      createdAt: now,
      lastSeen: now,
      resolvedAt: now,
    };
    this.#sessions.set(session.id, session);
    return session;
  }

  /** Look up a live session without counting it as activity. */
  get(id: string, computerId: string): ComputerSession | undefined {
    this.#prune();
    const session = this.#sessions.get(id);
    return session && session.computerId === computerId && !session.revoked ? session : undefined;
  }

  /** Look up a live session for `computerId` and mark it seen. */
  touch(id: string | undefined, computerId: string): ComputerSession | undefined {
    if (!id) return undefined;
    this.#prune();
    const session = this.#sessions.get(id);
    if (!session || session.computerId !== computerId || session.revoked) return undefined;
    session.lastSeen = this.#now();
    return session;
  }

  /** End a session normally (its socket closed). */
  end(session: ComputerSession): void {
    this.#remove(session);
  }

  revoke(session: ComputerSession): void {
    session.revoked = true;
    this.#remove(session);
  }

  #oldestFor(computerId: string, limit: number): ComputerSession | undefined {
    let count = 0;
    let oldest: ComputerSession | undefined;
    for (const session of this.#sessions.values()) {
      if (session.computerId !== computerId) continue;
      count += 1;
      oldest ??= session;
    }
    return count >= limit ? oldest : undefined;
  }

  #prune(): void {
    const now = this.#now();
    for (const session of [...this.#sessions.values()]) {
      if (now - session.lastSeen >= SESSION_IDLE_TTL_MS || now - session.createdAt >= SESSION_MAX_LIFETIME_MS) {
        this.#remove(session);
      }
    }
  }

  #remove(session: ComputerSession): void {
    if (this.#sessions.delete(session.id)) {
      this.#onRemove?.(session);
    }
  }
}
