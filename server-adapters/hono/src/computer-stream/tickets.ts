import {
  MAX_OUTSTANDING_TICKETS,
  TICKET_ISSUANCE_LIMIT,
  TICKET_ISSUANCE_WINDOW_MS,
  UPGRADE_TICKET_TTL_MS,
} from '../browser-stream/upgrade-tickets';

export type ComputerViewMode = 'watch' | 'control';

/** What a computer viewer ticket authorizes: one computer, seen from one thread. */
export interface ComputerTicketPayload {
  computerId: string;
  threadId: string;
  resourceId: string;
  mode: ComputerViewMode;
  /** Origin of the Studio that minted the ticket; allowed to frame the viewer. */
  studioOrigin: string;
}

export type ComputerTicketIssueResult =
  | { ok: true; ticket: string; expiresIn: number }
  | { ok: false; reason: 'rate-limited' | 'capacity' };

const MAX_TRACKED_COMPUTERS = 500;

/** 256 bits of base64url, so a ticket or session id can't be guessed. */
export function randomId(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Short-lived, single-use tickets that carry an authorized viewer request from
 * the authenticated session route to the websockify upgrade, which a browser
 * WebSocket can't authenticate with an `Authorization` header. Same bounds as
 * the browser-stream upgrade tickets, keyed per computer.
 */
export class ComputerTicketStore {
  readonly #tickets = new Map<string, ComputerTicketPayload & { expiresAt: number }>();
  readonly #issuance = new Map<string, { windowStart: number; count: number }>();
  readonly #now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.#now = now;
  }

  issue(payload: ComputerTicketPayload, ttlMs: number = UPGRADE_TICKET_TTL_MS): ComputerTicketIssueResult {
    const now = this.#now();
    for (const [ticket, entry] of this.#tickets) {
      if (entry.expiresAt > now) break;
      this.#tickets.delete(ticket);
    }
    if (this.#tickets.size >= MAX_OUTSTANDING_TICKETS) {
      return { ok: false, reason: 'capacity' };
    }

    const window = this.#issuance.get(payload.computerId);
    if (!window || now - window.windowStart >= TICKET_ISSUANCE_WINDOW_MS) {
      this.#issuance.delete(payload.computerId);
      this.#issuance.set(payload.computerId, { windowStart: now, count: 0 });
      if (this.#issuance.size > MAX_TRACKED_COMPUTERS) {
        const oldest = this.#issuance.keys().next().value;
        if (oldest !== undefined) this.#issuance.delete(oldest);
      }
    } else if (window.count >= TICKET_ISSUANCE_LIMIT) {
      return { ok: false, reason: 'rate-limited' };
    }
    this.#issuance.get(payload.computerId)!.count += 1;

    const ticket = randomId();
    this.#tickets.set(ticket, { ...payload, expiresAt: now + ttlMs });
    return { ok: true, ticket, expiresIn: Math.ceil(ttlMs / 1000) };
  }

  /** Spend a ticket issued for `computerId`; a second presentation fails. */
  consume(ticket: string, computerId: string): ComputerTicketPayload | undefined {
    const entry = this.#tickets.get(ticket);
    if (!entry || entry.computerId !== computerId) return undefined;
    this.#tickets.delete(ticket);
    if (entry.expiresAt <= this.#now()) return undefined;
    const { expiresAt: _expiresAt, ...payload } = entry;
    return payload;
  }
}
