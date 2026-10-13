const TICKET_BYTES = 32;

/**
 * How long an issued ticket stays valid. A ticket is minted immediately before
 * the socket is opened, so this only has to cover the round trip plus the
 * handshake — short enough that a ticket leaked from a log is useless by the
 * time anyone can act on it.
 */
export const UPGRADE_TICKET_TTL_MS = 30_000;

/**
 * Ceiling on tickets held in memory at once. A ticket is only useful during the
 * round trip between minting and the upgrade, so a store this full is a client
 * asking for tickets it never spends — reject rather than keep allocating.
 */
export const MAX_OUTSTANDING_TICKETS = 500;

/** How many tickets one agent may be issued inside {@link TICKET_ISSUANCE_WINDOW_MS}. */
export const TICKET_ISSUANCE_LIMIT = 30;

/** Length of the per-agent issuance window. */
export const TICKET_ISSUANCE_WINDOW_MS = 60_000;

/**
 * Ceiling on tracked per-agent issuance counters, so the limiter can't grow
 * without bound as agent ids are invented. Counters are evicted oldest first.
 */
const MAX_TRACKED_AGENTS = 500;

interface StoredTicket {
  agentId: string;
  threadId?: string;
  expiresAt: number;
}

interface IssuanceWindow {
  windowStart: number;
  count: number;
}

export interface IssuedUpgradeTicket {
  ticket: string;
  /** Lifetime in seconds, for the client's `expiresIn` field. */
  expiresIn: number;
}

export type UpgradeTicketIssueResult =
  | ({ ok: true } & IssuedUpgradeTicket)
  | { ok: false; reason: 'rate-limited' | 'capacity' };

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
 *
 * Issuance is bounded so the mint endpoint can't be turned into memory or CPU
 * exhaustion: tickets that are never spent live at most one TTL, a full store
 * rejects instead of growing, and each agent has a request allowance. Expiry is
 * swept from the front of the insertion-ordered map, so cleanup costs the
 * number of entries actually expired rather than a scan of every outstanding
 * ticket per request.
 */
export class UpgradeTicketStore {
  readonly #tickets = new Map<string, StoredTicket>();
  readonly #issuance = new Map<string, IssuanceWindow>();
  readonly #now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.#now = now;
  }

  /**
   * Issue a ticket bound to one agent and thread. Returns `{ ok: false }` when
   * the agent exceeded its allowance or the store is at capacity.
   */
  issue(agentId: string, threadId?: string, ttlMs: number = UPGRADE_TICKET_TTL_MS): UpgradeTicketIssueResult {
    const now = this.#now();
    this.#prune(now);

    if (this.#tickets.size >= MAX_OUTSTANDING_TICKETS) {
      return { ok: false, reason: 'capacity' };
    }

    const window = this.#issuance.get(agentId);
    if (!window || now - window.windowStart >= TICKET_ISSUANCE_WINDOW_MS) {
      this.#trackIssuance(agentId, { windowStart: now, count: 0 });
    } else if (window.count >= TICKET_ISSUANCE_LIMIT) {
      return { ok: false, reason: 'rate-limited' };
    }
    this.#issuance.get(agentId)!.count += 1;

    const ticket = createTicketValue();
    this.#tickets.set(ticket, { agentId, threadId, expiresAt: now + ttlMs });

    return { ok: true, ticket, expiresIn: Math.ceil(ttlMs / 1000) };
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

  /**
   * Drop expired tickets from the front of the insertion-ordered map. Tickets
   * are inserted in issue order and share a TTL, so the entries after the first
   * live one are live too and the sweep can stop there.
   */
  #prune(now: number): void {
    for (const [ticket, entry] of this.#tickets) {
      if (entry.expiresAt > now) break;
      this.#tickets.delete(ticket);
    }
  }

  /** Record an issuance window, evicting the oldest counter when at the cap. */
  #trackIssuance(agentId: string, window: IssuanceWindow): void {
    this.#issuance.delete(agentId);
    this.#issuance.set(agentId, window);
    if (this.#issuance.size > MAX_TRACKED_AGENTS) {
      const oldest = this.#issuance.keys().next().value;
      if (oldest !== undefined) this.#issuance.delete(oldest);
    }
  }
}
