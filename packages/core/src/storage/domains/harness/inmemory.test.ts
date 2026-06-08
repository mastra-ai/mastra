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
    modelId: '__GATEWAY_OPENAI_MODEL__',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    lastActivityAt: new Date('2026-01-01T00:00:00.000Z'),
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

    await storage.saveSession(sampleSession({ modelId: '__GATEWAY_OPENAI_MODEL__' }));
    await storage.saveSession(sampleSession({ modelId: '__GATEWAY_ANTHROPIC_MODEL_SONNET__' }));

    expect(await storage.loadSession('session-1')).toEqual(
      sampleSession({ modelId: '__GATEWAY_ANTHROPIC_MODEL_SONNET__' }),
    );
  });

  it('does not expose live session record references', async () => {
    const storage = new InMemoryHarness();
    const session = sampleSession();

    await storage.saveSession(session);
    session.modelId = '__GATEWAY_ANTHROPIC_MODEL_SONNET__';
    session.createdAt.setFullYear(2027);

    const loaded = await storage.loadSession('session-1');
    expect(loaded).toEqual(sampleSession());

    loaded!.modelId = '__GATEWAY_ANTHROPIC_MODEL_SONNET__';
    loaded!.lastActivityAt.setFullYear(2027);

    expect(await storage.loadSession('session-1')).toEqual(sampleSession());

    const [listed] = await storage.listSessions();
    listed!.modelId = '__GATEWAY_ANTHROPIC_MODEL_SONNET__';

    expect(await storage.loadSession('session-1')).toEqual(sampleSession());
  });
});
