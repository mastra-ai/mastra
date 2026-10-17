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
  const tracker = () => new OMOperationTracker({ storage: makeStorage() });

  it('is inactive until begun', async () => {
    expect(await tracker().isActive({ recordId: 'unreg-1', operation: 'reflecting' })).toBe(false);
  });

  it('registers synchronously, before the caller awaits', async () => {
    const t = tracker();
    t.begin({ recordId: 'sync-1', operation: 'bufferingObservation' });
    const active = t.isActive({ recordId: 'sync-1', operation: 'bufferingObservation' });
    t.end({ recordId: 'sync-1', operation: 'bufferingObservation' });
    expect(await active).toBe(true);
  });

  it('is inactive after end', async () => {
    const t = tracker();
    t.begin({ recordId: 'end-1', operation: 'reflecting' });
    t.end({ recordId: 'end-1', operation: 'reflecting' });
    expect(await t.isActive({ recordId: 'end-1', operation: 'reflecting' })).toBe(false);
  });

  it('tracks operations and records independently', async () => {
    const t = tracker();
    t.begin({ recordId: 'multi-1', operation: 'observing' });
    t.begin({ recordId: 'multi-1', operation: 'reflecting' });
    t.begin({ recordId: 'multi-2', operation: 'observing' });
    t.end({ recordId: 'multi-1', operation: 'observing' });

    expect(await t.isActive({ recordId: 'multi-1', operation: 'observing' })).toBe(false);
    expect(await t.isActive({ recordId: 'multi-1', operation: 'reflecting' })).toBe(true);
    expect(await t.isActive({ recordId: 'multi-1', operation: 'bufferingObservation' })).toBe(false);
    expect(await t.isActive({ recordId: 'multi-2', operation: 'observing' })).toBe(true);

    t.end({ recordId: 'multi-1', operation: 'reflecting' });
    t.end({ recordId: 'multi-2', operation: 'observing' });
  });

  it('counts repeated begins, so chained buffers keep the op active until the last ends', async () => {
    const t = tracker();
    t.begin({ recordId: 'dup-1', operation: 'bufferingObservation' });
    t.begin({ recordId: 'dup-1', operation: 'bufferingObservation' });
    t.end({ recordId: 'dup-1', operation: 'bufferingObservation' });
    expect(await t.isActive({ recordId: 'dup-1', operation: 'bufferingObservation' })).toBe(true);
    t.end({ recordId: 'dup-1', operation: 'bufferingObservation' });
    expect(await t.isActive({ recordId: 'dup-1', operation: 'bufferingObservation' })).toBe(false);
  });

  it('tolerates ending more times than begun', async () => {
    const t = tracker();
    t.begin({ recordId: 'idem-1', operation: 'bufferingObservation' });
    t.end({ recordId: 'idem-1', operation: 'bufferingObservation' });
    t.end({ recordId: 'idem-1', operation: 'bufferingObservation' });
    expect(await t.isActive({ recordId: 'idem-1', operation: 'bufferingObservation' })).toBe(false);
  });

  it('sees operations begun by another OM instance in the same process', async () => {
    const storage = makeStorage();
    const a = new OMOperationTracker({ storage: storage });
    const b = new OMOperationTracker({ storage: storage });
    a.begin({ recordId: 'shared-1', operation: 'reflecting' });
    expect(await b.isActive({ recordId: 'shared-1', operation: 'reflecting' })).toBe(true);
    a.end({ recordId: 'shared-1', operation: 'reflecting' });
  });
});
