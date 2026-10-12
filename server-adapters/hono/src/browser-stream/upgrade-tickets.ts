const TICKET_BYTES = 32;

/**
 * How long an issued ticket stays valid. A ticket is minted immediately before
 * the socket is opened, so this only has to cover the round trip plus the
 * handshake — short enough that a ticket leaked from a log is useless by the
 * time anyone can act on it.
 */
export const UPGRADE_TICKET_TTL_MS = 30_000;

interface StoredTicket {
  agentId: string;
  threadId?: string;
  expiresAt: number;
}

export interface IssuedUpgradeTicket {
  ticket: string;
  /** Lifetime in seconds, for the client's `expiresIn` field. */
  expiresIn: number;
}

/** 256 bits of base64url, so the ticket can't be guessed or enumerated. */
function createTicketValue(): string {
  const bytes = new Uint8Array(TICKET_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Short-lived, single-use credentials for browser WebSocket upgrades.
 *
 * A browser cannot set an `Authorization` header on a WebSocket handshake, so a
 * deployment that authenticates with a header token would otherwise have to put
 * that reusable token in the handshake URL, where proxies and access logs can
 * retain it. Instead the client asks an authenticated HTTP route for a ticket,
 * and the ticket — worthless once spent, and scoped to one agent and thread —
 * travels in the URL instead.
 *
 * In-process, like the `ViewerRegistry` and the browser sessions it serves: a
 * screencast is bound to the process holding the browser, so a ticket store
 * shared across replicas would buy nothing. A ticket presented to a different
 * replica fails for the same reason the stream itself would.
 */
export class UpgradeTicketStore {
  readonly #tickets = new Map<string, StoredTicket>();
  readonly #now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.#now = now;
  }

  /**
   * Issue a ticket bound to one agent and thread.
   */
  issue(agentId: string, threadId?: string, ttlMs: number = UPGRADE_TICKET_TTL_MS): IssuedUpgradeTicket {
    const now = this.#now();
    this.#prune(now);

    const ticket = createTicketValue();
    this.#tickets.set(ticket, { agentId, threadId, expiresAt: now + ttlMs });

    return { ticket, expiresIn: Math.ceil(ttlMs / 1000) };
  }

  /**
   * Spend a ticket. Returns `true` only when the ticket is unexpired and was
   * issued for this exact agent and thread, in which case it is consumed and a
   * second presentation fails.
   */
  consume(ticket: string, agentId: string, threadId?: string): boolean {
    const entry = this.#tickets.get(ticket);
    if (!entry) return false;
    if (entry.expiresAt <= this.#now()) return false;
    if (entry.agentId !== agentId) return false;
    if ((entry.threadId ?? undefined) !== (threadId ?? undefined)) return false;

    this.#tickets.delete(ticket);
    return true;
  }

  #prune(now: number): void {
    for (const [ticket, entry] of this.#tickets) {
      if (entry.expiresAt <= now) this.#tickets.delete(ticket);
    }
  }
}
