import { describe, expect, it } from 'vitest';
import { InMemoryActionStorage } from './storage';
import { createUlid } from './ulid';

describe('InMemoryActionStorage (offline)', () => {
  it('drops transient actions and rejects duplicate ids', async () => {
    const storage = new InMemoryActionStorage();
    const id = createUlid();
    const base = { threadId: 't', createdAt: new Date() };
    await storage.record([
      { ...base, id: id(), type: 'text', role: 'user', text: 'hi' },
      { ...base, id: id(), type: 'tool-result', toolCallId: 'c', toolName: 'x', output: 'partial', transient: true },
      { ...base, id: id(), type: 'tool-result', toolCallId: 'c', toolName: 'x', output: 'final' },
    ]);

    const stored = await storage.listActions({ threadId: 't' });
    expect(stored.map(a => ('output' in a ? a.output : a.type))).toEqual(['text', 'final']);
    await expect(storage.saveActions({ actions: [stored[0]!] })).rejects.toThrow(/append-only/);
  });

  it('mints monotonic ULIDs within the same millisecond', () => {
    const id = createUlid();
    const ids = Array.from({ length: 1000 }, () => id(1_700_000_000_000));
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(1000);
  });
});
