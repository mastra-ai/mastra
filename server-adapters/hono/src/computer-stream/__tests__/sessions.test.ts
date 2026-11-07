import { describe, expect, it } from 'vitest';

import {
  ComputerSessionStore,
  MAX_SESSIONS,
  MAX_SESSIONS_PER_COMPUTER,
  SESSION_IDLE_TTL_MS,
  SESSION_MAX_LIFETIME_MS,
} from '../sessions.js';
import type { NewComputerSession } from '../sessions.js';
import { ComputerTicketStore } from '../tickets.js';

const input = (computerId: string): NewComputerSession => ({
  computerId,
  threadId: 'thread-1',
  resourceId: 'res-1',
  mode: 'watch',
  studioOrigin: 'http://studio.test',
  viewer: { base: new URL('http://upstream/'), headers: { cookie: 'a=b' } },
});

function clock() {
  let now = 1_000_000;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe('ComputerSessionStore', () => {
  it('binds sessions to their computer', () => {
    const store = new ComputerSessionStore();
    const session = store.insert(input('c1'))!;
    expect(session.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(store.touch(session.id, 'c1')).toBe(session);
    expect(store.touch(session.id, 'c2')).toBeUndefined();
    expect(store.touch(undefined, 'c1')).toBeUndefined();
  });

  it('expires idle sessions, slides on use, and caps absolute lifetime', () => {
    const t = clock();
    const store = new ComputerSessionStore({ now: t.now });
    const idle = store.insert(input('c1'))!;
    const active = store.insert(input('c1'))!;
    t.advance(SESSION_IDLE_TTL_MS - 1);
    expect(store.touch(active.id, 'c1')).toBe(active);
    t.advance(1);
    expect(store.touch(idle.id, 'c1')).toBeUndefined();
    expect(store.touch(active.id, 'c1')).toBe(active);
    // now = 15 min; keep it busy until just before the 60 min absolute lifetime.
    for (let i = 0; i < 4; i++) {
      t.advance(10 * 60_000);
      expect(store.touch(active.id, 'c1')).toBe(active);
    }
    t.advance(SESSION_MAX_LIFETIME_MS - 55 * 60_000);
    expect(store.touch(active.id, 'c1')).toBeUndefined();
  });

  it('evicts the computer’s own oldest session at the per-computer cap', () => {
    const removed: string[] = [];
    const store = new ComputerSessionStore({ onRemove: s => removed.push(s.id) });
    const first = store.insert(input('c1'))!;
    for (let i = 1; i < MAX_SESSIONS_PER_COMPUTER; i++) store.insert(input('c1'));
    expect(store.size).toBe(MAX_SESSIONS_PER_COMPUTER);
    store.insert(input('c1'));
    expect(store.size).toBe(MAX_SESSIONS_PER_COMPUTER);
    expect(removed).toEqual([first.id]);
  });

  it('rejects at the global cap without evicting other computers', () => {
    const store = new ComputerSessionStore();
    for (let i = 0; i < MAX_SESSIONS; i++) expect(store.insert(input(`c${i}`))).toBeDefined();
    expect(store.hasCapacity('new')).toBe(false);
    expect(store.insert(input('new'))).toBeUndefined();
    // A computer at its own cap can still rotate its sessions.
    expect(store.size).toBe(MAX_SESSIONS);
  });

  it('revoked sessions stop resolving', () => {
    const store = new ComputerSessionStore();
    const session = store.insert(input('c1'))!;
    store.revoke(session);
    expect(session.revoked).toBe(true);
    expect(store.touch(session.id, 'c1')).toBeUndefined();
  });
});

describe('ComputerTicketStore', () => {
  const payload = {
    computerId: 'c1',
    threadId: 't',
    resourceId: 'r',
    mode: 'control' as const,
    studioOrigin: 'http://s',
  };

  it('is single-use, computer-bound and expires', () => {
    const t = clock();
    const store = new ComputerTicketStore(t.now);
    const a = store.issue(payload);
    if (!a.ok) throw new Error('expected ticket');
    expect(store.consume(a.ticket, 'c2')).toBeUndefined();
    expect(store.consume(a.ticket, 'c1')).toEqual(payload);
    expect(store.consume(a.ticket, 'c1')).toBeUndefined();

    const b = store.issue(payload);
    if (!b.ok) throw new Error('expected ticket');
    t.advance(30_000);
    expect(store.consume(b.ticket, 'c1')).toBeUndefined();
  });
});
