import type { Mastra } from '@mastra/core/mastra';

export type ComputerViewMode = 'watch' | 'control';

export interface ComputerTicketPayload {
  computerId: string;
  threadId: string;
  resourceId: string;
  mode: ComputerViewMode;
  studioOrigin: string;
}

export type ComputerTicketIssueResult =
  | { ok: true; ticket: string; expiresIn: number }
  | { ok: false; reason: 'rate-limited' | 'capacity' };

export interface ComputerTicketStore {
  issue(payload: ComputerTicketPayload, ttlMs?: number): Promise<ComputerTicketIssueResult>;
  consume(ticket: string, computerId: string): Promise<ComputerTicketPayload | undefined>;
}

const TICKET_TTL_MS = 30_000;
const MAX_OUTSTANDING_TICKETS = 500;
const TICKET_ISSUANCE_LIMIT = 30;
const TICKET_ISSUANCE_WINDOW_MS = 60_000;
const MAX_TRACKED_COMPUTERS = 500;

function randomId(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

export class InMemoryComputerTicketStore implements ComputerTicketStore {
  readonly #tickets = new Map<string, ComputerTicketPayload & { expiresAt: number }>();
  readonly #issuance = new Map<string, { windowStart: number; count: number }>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async issue(payload: ComputerTicketPayload, ttlMs: number = TICKET_TTL_MS): Promise<ComputerTicketIssueResult> {
    const now = this.now();
    for (const [ticket, entry] of this.#tickets) {
      if (entry.expiresAt > now) break;
      this.#tickets.delete(ticket);
    }
    if (this.#tickets.size >= MAX_OUTSTANDING_TICKETS) return { ok: false, reason: 'capacity' };

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

  async consume(ticket: string, computerId: string): Promise<ComputerTicketPayload | undefined> {
    const entry = this.#tickets.get(ticket);
    if (!entry || entry.computerId !== computerId) return undefined;
    this.#tickets.delete(ticket);
    if (entry.expiresAt <= this.now()) return undefined;
    const { expiresAt: _expiresAt, ...payload } = entry;
    return payload;
  }
}

export interface ComputerServerState {
  ticketStore: ComputerTicketStore;
  /** Browser origins allowed to mint tickets in addition to the server's own host. */
  allowedOrigins?: string | string[];
}

const states = new WeakMap<Mastra, ComputerServerState>();

export function configureComputerServer(mastra: Mastra, state: ComputerServerState): void {
  states.set(mastra, state);
}

export function getComputerServerState(mastra: Mastra): ComputerServerState | undefined {
  return states.get(mastra);
}
