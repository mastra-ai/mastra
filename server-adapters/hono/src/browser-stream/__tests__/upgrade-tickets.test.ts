import { describe, expect, it } from 'vitest';

import {
  MAX_OUTSTANDING_TICKETS,
  TICKET_ISSUANCE_LIMIT,
  TICKET_ISSUANCE_WINDOW_MS,
  UPGRADE_TICKET_TTL_MS,
  UpgradeTicketStore,
} from '../upgrade-tickets';

function createStore(start = 1_000_000) {
  let now = start;
  const store = new UpgradeTicketStore(() => now);
  return {
    store,
    advance(ms: number) {
      now += ms;
    },
    get now() {
      return now;
    },
  };
}

function issueOrThrow(store: UpgradeTicketStore, agentId: string, threadId?: string) {
  const issued = store.issue(agentId, threadId);
  if (!issued.ok) throw new Error(`unexpected issuance failure: ${issued.reason}`);
  return issued.ticket;
}

describe('UpgradeTicketStore', () => {
  it('issues a single-use ticket scoped to the agent and thread', () => {
    const { store } = createStore();

    const ticket = issueOrThrow(store, 'agent-1', 'thread-1');

    expect(ticket.length).toBeGreaterThan(20);
    expect(store.consume(ticket, 'agent-1', 'thread-1')).toBe(true);
    expect(store.consume(ticket, 'agent-1', 'thread-1')).toBe(false);
  });

  it('refuses a ticket issued for another agent or thread', () => {
    const { store } = createStore();

    const threadScoped = issueOrThrow(store, 'agent-1', 'thread-1');
    expect(store.consume(threadScoped, 'agent-2', 'thread-1')).toBe(false);
    expect(store.consume(threadScoped, 'agent-1', 'thread-2')).toBe(false);
    expect(store.consume(threadScoped, 'agent-1')).toBe(false);

    const agentScoped = issueOrThrow(store, 'agent-1');
    expect(store.consume(agentScoped, 'agent-1', 'thread-1')).toBe(false);
    expect(store.consume(agentScoped, 'agent-1')).toBe(true);
  });

  it('refuses an expired ticket', () => {
    const { store, advance } = createStore();

    const ticket = issueOrThrow(store, 'agent-1');

    advance(UPGRADE_TICKET_TTL_MS - 1);
    expect(store.consume(ticket, 'agent-1')).toBe(true);

    const expiring = issueOrThrow(store, 'agent-1');
    advance(UPGRADE_TICKET_TTL_MS);
    expect(store.consume(expiring, 'agent-1')).toBe(false);
  });

  it('caps issuance per agent and resets when the window rolls over', () => {
    const { store, advance } = createStore();

    for (let i = 0; i < TICKET_ISSUANCE_LIMIT; i++) {
      expect(store.issue('agent-1').ok).toBe(true);
    }

    expect(store.issue('agent-1')).toEqual({ ok: false, reason: 'rate-limited' });
    // Another agent has its own allowance.
    expect(store.issue('agent-2').ok).toBe(true);

    advance(TICKET_ISSUANCE_WINDOW_MS);
    expect(store.issue('agent-1').ok).toBe(true);
  });

  it('refuses issuance at capacity instead of growing without bound', () => {
    const { store } = createStore();

    for (let i = 0; i < MAX_OUTSTANDING_TICKETS; i++) {
      // A distinct agent per ticket keeps each issuance window separate, so
      // this exercises capacity rather than the per-agent allowance.
      expect(store.issue(`agent-${i}`).ok).toBe(true);
    }

    expect(store.issue('agent-overflow')).toEqual({ ok: false, reason: 'capacity' });
  });

  it('frees capacity after the TTL, so unused tickets are not retained', () => {
    const { store, advance } = createStore();

    for (let i = 0; i < MAX_OUTSTANDING_TICKETS; i++) {
      store.issue(`agent-${i}`);
    }
    expect(store.issue('agent-overflow')).toEqual({ ok: false, reason: 'capacity' });

    advance(UPGRADE_TICKET_TTL_MS);

    expect(store.issue('agent-after-expiry').ok).toBe(true);
  });
});
