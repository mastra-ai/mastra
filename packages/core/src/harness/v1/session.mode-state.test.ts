/**
 * Harness v1 — Session.getCurrentMode/getCurrentModel/setMode/setModel +
 * getDisplayState. Mode/model setters CAS-write through storage, so we
 * verify both the in-memory state and the stored record.
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';

import { Harness } from './harness';

function makeAgent(name: string) {
  return new Agent({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
}

function setup() {
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { a: makeAgent('a'), b: makeAgent('b') } as any,
    modes: [
      { id: 'modeA', agentId: 'a' },
      { id: 'modeB', agentId: 'b' },
    ],
    defaultModeId: 'modeA',
    sessions: { storage },
  });
  return { harness, storage };
}

describe('Session.getCurrentMode / getCurrentModel', () => {
  it('returns the mode object resolved from the session record', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    expect(session.getCurrentMode().id).toBe('modeA');
    expect(session.getCurrentMode().agentId).toBe('a');
  });

  it('reflects the modelId stored on the record', async () => {
    const { harness } = setup();
    const session = await harness.session({
      resourceId: 'u1',
      threadId: { fresh: true },
      modelId: 'gpt-5-mini',
    });
    expect(session.getCurrentModel()).toBe('gpt-5-mini');
  });
});

describe('Session.setMode', () => {
  it('flips the active mode and persists', async () => {
    const { harness, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.setMode('modeB');
    expect(session.getCurrentMode().id).toBe('modeB');

    const stored = await storage.loadSession({ sessionId: session.id });
    expect(stored?.modeId).toBe('modeB');
  });

  it('rejects unknown modes', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await expect(session.setMode('does-not-exist')).rejects.toThrow(/unknown mode/);
  });

  it('is a no-op when set to the current mode (no version bump)', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const v = session._internalRecordVersion;
    await session.setMode('modeA');
    expect(session._internalRecordVersion).toBe(v);
  });
});

describe('Session.setModel', () => {
  it('persists the new model id', async () => {
    const { harness, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.setModel('gpt-5');
    expect(session.getCurrentModel()).toBe('gpt-5');

    const stored = await storage.loadSession({ sessionId: session.id });
    expect(stored?.modelId).toBe('gpt-5');
  });
});

describe('Session.getDisplayState', () => {
  it('returns a snapshot of the live record', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const ds = session.getDisplayState();
    expect(ds.sessionId).toBe(session.id);
    expect(ds.threadId).toBe(session.threadId);
    expect(ds.resourceId).toBe('u1');
    expect(ds.lifecycleState).toBe('live');
    expect(ds.modeId).toBe('modeA');
    expect(ds.queueDepth).toBe(0);
    expect(ds.hasPendingApproval).toBe(false);
    expect(ds.hasPendingSuspension).toBe(false);
    expect(ds.hasPendingQuestion).toBe(false);
    expect(ds.hasPendingPlan).toBe(false);
  });
});
