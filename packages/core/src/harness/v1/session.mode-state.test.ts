import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { HarnessConfigError, HarnessSessionClosedError } from './errors';
import type { HarnessEvent } from './events';
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

class BlockingRenewStorage extends InMemoryHarness {
  private releaseRenew!: () => void;
  private resolveRenewStarted: () => void = () => undefined;
  readonly renewStarted = new Promise<void>(resolve => {
    this.resolveRenewStarted = resolve;
  });
  readonly renewGate = new Promise<void>(resolve => {
    this.releaseRenew = resolve;
  });

  override async renewSessionLease(opts: Parameters<InMemoryHarness['renewSessionLease']>[0]) {
    const result = await super.renewSessionLease(opts);
    this.resolveRenewStarted();
    await this.renewGate;
    return result;
  }

  unblockRenewal(): void {
    this.releaseRenew();
  }
}

describe('Session mode and state', () => {
  it('returns the mode object resolved from the session record', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    expect(session.getCurrentMode().id).toBe('modeA');
    expect(session.getCurrentMode().agentId).toBe('a');
  });

  it('switches the active mode and persists it', async () => {
    const { harness, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.switchMode({ mode: 'modeB' });

    expect(session.getCurrentMode().id).toBe('modeB');
    await expect(storage.loadSession({ sessionId: session.id })).resolves.toMatchObject({ modeId: 'modeB' });
  });

  it('rejects unknown modes without mutating the record', async () => {
    const { harness, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.switchMode({ mode: 'does-not-exist' })).rejects.toThrow(HarnessConfigError);

    await expect(storage.loadSession({ sessionId: session.id })).resolves.toMatchObject({ modeId: 'modeA' });
  });

  it('does not bump the record version when switching to the current mode', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const version = session._internalRecordVersion;

    await session.switchMode({ mode: 'modeA' });

    expect(session._internalRecordVersion).toBe(version);
  });

  it('reads and persists shallow-merged state updates', async () => {
    const { harness, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.setState<{ count: number; label?: string }>({ count: 1 });
    await session.setState<{ count: number; label?: string }>({ label: 'ready' });

    await expect(session.getState()).resolves.toEqual({ count: 1, label: 'ready' });
    await expect(storage.loadSession({ sessionId: session.id })).resolves.toMatchObject({
      state: { count: 1, label: 'ready' },
    });
  });

  it('emits state_changed after a persisted state update', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const events: HarnessEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.setState<{ count?: number; label?: string }>({ count: 1, label: 'ready' });
    await session.setState<{ count?: number; label?: string }>({ count: 1 });

    expect(events.filter(event => event.type === 'state_changed')).toEqual([
      expect.objectContaining({ type: 'state_changed', changedKeys: ['count', 'label'] }),
    ]);
  });

  it('serializes functional state updates through the session record version', async () => {
    const { harness, storage } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await Promise.all([
      session.setState<{ count: number }>(prev => ({ count: (prev.count ?? 0) + 1 })),
      session.setState<{ count: number }>(prev => ({ count: (prev.count ?? 0) + 1 })),
      session.setState<{ count: number }>(prev => ({ count: (prev.count ?? 0) + 1 })),
    ]);

    await expect(session.getState()).resolves.toEqual({ count: 3 });
    await expect(storage.loadSession({ sessionId: session.id })).resolves.toMatchObject({ state: { count: 3 } });
  });

  it('does not let lease renewal lower the in-memory record version after a flush', async () => {
    const storage = new BlockingRenewStorage({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { a: makeAgent('a') } as any,
      modes: [{ id: 'modeA', agentId: 'a' }],
      defaultModeId: 'modeA',
      sessions: { storage, leaseTtlMs: 30_000 },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const renewing = (session as unknown as { renewLease(): Promise<void> }).renewLease();

    await storage.renewStarted;
    await session.setState<{ count?: number }>({ count: 1 });
    const versionAfterFlush = session._internalRecordVersion;
    storage.unblockRenewal();
    await renewing;

    expect(session._internalRecordVersion).toBe(versionAfterFlush);
    await expect(session.setState<{ count?: number; label?: string }>({ label: 'next' })).resolves.toBeUndefined();
    await expect(session.getState()).resolves.toEqual({ count: 1, label: 'next' });
    await session.close();
  });

  it('rejects mode and state mutations after close', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.close();

    expect(() => session.getCurrentMode()).toThrow(HarnessSessionClosedError);
    await expect(session.switchMode({ mode: 'modeB' })).rejects.toThrow(HarnessSessionClosedError);
    await expect(session.getState()).rejects.toThrow(HarnessSessionClosedError);
    await expect(session.setState({ closed: true })).rejects.toThrow(HarnessSessionClosedError);
  });
});
