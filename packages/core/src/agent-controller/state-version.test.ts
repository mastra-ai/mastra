import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../storage/mock';
import { createTestSession } from './test-utils';
import type { AgentControllerEvent } from './types';
import { defaultDisplayState } from './types';

type StampedEvent = Extract<AgentControllerEvent, { type: 'agent_start' | 'agent_end' | 'task_updated' }>;

describe('display-state version', () => {
  it('mints a fresh epoch per display state and starts the version at zero', () => {
    const a = defaultDisplayState();
    const b = defaultDisplayState();
    expect(a.stateVersion).toBe(0);
    expect(a.stateEpoch).toBeTruthy();
    expect(a.stateEpoch).not.toBe(b.stateEpoch);
  });

  it('advances the version with every event folded into the display state', async () => {
    const { session } = await createTestSession({ storage: new InMemoryStore() });
    const before = session.displayState.get().stateVersion;
    session.emit({ type: 'agent_start' });
    session.emit({ type: 'agent_end', reason: 'complete' });
    expect(session.displayState.get().stateVersion).toBe(before + 2);
  });

  it('stamps run lifecycle and task events with the post-transition version and epoch', async () => {
    const { session } = await createTestSession({ storage: new InMemoryStore() });
    const seen: StampedEvent[] = [];
    session.subscribe(event => {
      if (event.type === 'agent_start' || event.type === 'agent_end' || event.type === 'task_updated') {
        seen.push(event);
      }
    });
    session.emit({ type: 'agent_start' });
    session.emit({ type: 'task_updated', tasks: [] });
    session.emit({ type: 'agent_end', reason: 'complete' });

    const ds = session.displayState.get();
    expect(seen).toHaveLength(3);
    expect(seen.map(event => event.stateEpoch)).toEqual([ds.stateEpoch, ds.stateEpoch, ds.stateEpoch]);
    const versions = seen.map(event => event.stateVersion ?? -1);
    expect([...versions].sort((x, y) => x - y)).toEqual(versions);
    expect(new Set(versions).size).toBe(3);
    expect(versions.at(-1)).toBe(ds.stateVersion);
  });
});
