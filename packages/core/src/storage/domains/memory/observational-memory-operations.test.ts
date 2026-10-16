import { describe, expect, it } from 'vitest';

import { InMemoryDB } from '../inmemory-db';
import { InMemoryMemory } from './inmemory';
import { InProcessObservationalMemoryOperations } from './observational-memory-operations';

const op = { recordId: 'rec-1', operation: 'reflecting' as const };
const claim = (owner: string) => ({ ...op, owner, ttlMs: 60_000 });

describe('InProcessObservationalMemoryOperations', () => {
  it('grants an unheld claim and reports its owner', () => {
    const ops = new InProcessObservationalMemoryOperations();
    expect(ops.claim(claim('a'))).toEqual({ claimed: true });
    expect(ops.getOwner(op)).toBe('a');
  });

  it('refuses another owner while held, and reports the holder', () => {
    const ops = new InProcessObservationalMemoryOperations();
    ops.claim(claim('a'));
    expect(ops.claim(claim('b'))).toEqual({ claimed: false, owner: 'a' });
  });

  it('counts claims by the same owner and frees on the last release', () => {
    const ops = new InProcessObservationalMemoryOperations();
    ops.claim(claim('a'));
    ops.claim(claim('a'));
    ops.release({ ...op, owner: 'a' });
    expect(ops.getOwner(op)).toBe('a');
    ops.release({ ...op, owner: 'a' });
    expect(ops.getOwner(op)).toBeUndefined();
    expect(ops.claim(claim('b'))).toEqual({ claimed: true });
  });

  it('ignores release and renew by a non-owner', () => {
    const ops = new InProcessObservationalMemoryOperations();
    ops.claim(claim('a'));
    ops.release({ ...op, owner: 'b' });
    expect(ops.getOwner(op)).toBe('a');
    expect(ops.renew(claim('b'))).toBe(false);
    expect(ops.renew(claim('a'))).toBe(true);
  });

  it('keys claims by record and operation', () => {
    const ops = new InProcessObservationalMemoryOperations();
    ops.claim(claim('a'));
    expect(ops.getOwner({ recordId: 'rec-1', operation: 'observing' })).toBeUndefined();
    expect(ops.getOwner({ recordId: 'rec-2', operation: 'reflecting' })).toBeUndefined();
  });
});

describe('MemoryStorage default operation claims', () => {
  it('registers a claim before the returned promise is awaited', () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    const ref = { recordId: 'sync-rec', operation: 'bufferingObservation' as const };
    void storage.claimObservationalMemoryOperation({ ...ref, owner: 'a', ttlMs: 60_000 });
    let owner: string | undefined;
    void storage.getObservationalMemoryOperationOwner(ref).then(o => (owner = o));
    return Promise.resolve()
      .then(() => expect(owner).toBe('a'))
      .finally(() => storage.releaseObservationalMemoryOperation({ ...ref, owner: 'a' }));
  });
});
