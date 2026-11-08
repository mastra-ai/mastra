import { describe, expect, it } from 'vitest';
import { InMemoryComputerTicketStore } from './index.js';

const payload = {
  computerId: 'c1',
  threadId: 'thread-1',
  resourceId: 'res-1',
  mode: 'control' as const,
  studioOrigin: 'https://studio.test',
};

describe('InMemoryComputerTicketStore', () => {
  it('atomically consumes a ticket once while preserving canonical origin binding', async () => {
    const store = new InMemoryComputerTicketStore(() => 1000);
    const issued = await store.issue(payload);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    await expect(store.consume(issued.ticket, 'other')).resolves.toBeUndefined();
    await expect(store.consume(issued.ticket, 'c1')).resolves.toEqual(payload);
    await expect(store.consume(issued.ticket, 'c1')).resolves.toBeUndefined();
  });

  it('deletes expired tickets during the atomic consume', async () => {
    let now = 1000;
    const store = new InMemoryComputerTicketStore(() => now);
    const issued = await store.issue(payload, 10);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    now = 1010;
    await expect(store.consume(issued.ticket, 'c1')).resolves.toBeUndefined();
    now = 1000;
    await expect(store.consume(issued.ticket, 'c1')).resolves.toBeUndefined();
  });
});
