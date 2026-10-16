import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import { OMOperationTracker } from '../operation-registry';

const withStorageClaims = () => new InMemoryMemory({ db: new InMemoryDB() });

/** An adapter built against a @mastra/core that predates operation claims. */
const withoutStorageClaims = () => {
  const storage = withStorageClaims();
  for (const method of [
    'claimObservationalMemoryOperation',
    'renewObservationalMemoryOperation',
    'releaseObservationalMemoryOperation',
    'getObservationalMemoryOperationOwner',
  ] as const) {
    Object.defineProperty(storage, method, { value: undefined });
  }
  return storage as MemoryStorage;
};

describe.each([
  ['storage claims', withStorageClaims],
  ['older @mastra/core fallback', withoutStorageClaims],
])('OMOperationTracker (%s)', (_name, makeStorage) => {
  const tracker = () => new OMOperationTracker(makeStorage());

  it('is inactive until begun', async () => {
    expect(await tracker().isActive('unreg-1', 'reflecting')).toBe(false);
  });

  it('registers synchronously, before the caller awaits', async () => {
    const t = tracker();
    t.begin('sync-1', 'bufferingObservation');
    const active = t.isActive('sync-1', 'bufferingObservation');
    t.end('sync-1', 'bufferingObservation');
    expect(await active).toBe(true);
  });

  it('is inactive after end', async () => {
    const t = tracker();
    t.begin('end-1', 'reflecting');
    t.end('end-1', 'reflecting');
    expect(await t.isActive('end-1', 'reflecting')).toBe(false);
  });

  it('tracks operations and records independently', async () => {
    const t = tracker();
    t.begin('multi-1', 'observing');
    t.begin('multi-1', 'reflecting');
    t.begin('multi-2', 'observing');
    t.end('multi-1', 'observing');

    expect(await t.isActive('multi-1', 'observing')).toBe(false);
    expect(await t.isActive('multi-1', 'reflecting')).toBe(true);
    expect(await t.isActive('multi-1', 'bufferingObservation')).toBe(false);
    expect(await t.isActive('multi-2', 'observing')).toBe(true);

    t.end('multi-1', 'reflecting');
    t.end('multi-2', 'observing');
  });

  it('counts repeated begins, so chained buffers keep the op active until the last ends', async () => {
    const t = tracker();
    t.begin('dup-1', 'bufferingObservation');
    t.begin('dup-1', 'bufferingObservation');
    t.end('dup-1', 'bufferingObservation');
    expect(await t.isActive('dup-1', 'bufferingObservation')).toBe(true);
    t.end('dup-1', 'bufferingObservation');
    expect(await t.isActive('dup-1', 'bufferingObservation')).toBe(false);
  });

  it('tolerates ending more times than begun', async () => {
    const t = tracker();
    t.begin('idem-1', 'bufferingObservation');
    t.end('idem-1', 'bufferingObservation');
    t.end('idem-1', 'bufferingObservation');
    expect(await t.isActive('idem-1', 'bufferingObservation')).toBe(false);
  });

  it('sees operations begun by another OM instance in the same process', async () => {
    const storage = makeStorage();
    const a = new OMOperationTracker(storage);
    const b = new OMOperationTracker(storage);
    a.begin('shared-1', 'reflecting');
    expect(await b.isActive('shared-1', 'reflecting')).toBe(true);
    a.end('shared-1', 'reflecting');
  });
});
