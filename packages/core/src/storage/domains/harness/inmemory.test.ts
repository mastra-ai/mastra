import { describe, expect, it } from 'vitest';

import { InMemoryHarness } from './inmemory';
import type { SessionRecord } from './types';

function sampleSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'session-1',
    ownerId: 'owner-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    origin: 'top-level',
    modeId: 'mode-1',
    modelId: 'model-1',
    ...overrides,
  };
}

describe('InMemoryHarness', () => {
  it('loads a saved session', async () => {
    const storage = new InMemoryHarness();
    const session = sampleSession();

    await storage.saveSession(session);

    expect(await storage.loadSession(session.id)).toEqual(session);
  });

  it('returns null for an unknown session', async () => {
    const storage = new InMemoryHarness();

    expect(await storage.loadSession('unknown')).toBeNull();
  });

  it('overwrites an existing session', async () => {
    const storage = new InMemoryHarness();

    await storage.saveSession(sampleSession({ modelId: 'model-1' }));
    await storage.saveSession(sampleSession({ modelId: 'model-2' }));

    expect(await storage.loadSession('session-1')).toEqual(sampleSession({ modelId: 'model-2' }));
  });
});
