import { describe, expect, it, vi } from 'vitest';
import { Session } from './session';
import { createMockWorkspace } from './test-utils';
import type { HarnessEvent } from './types';

describe('Session event bus', () => {
  it('delivers emitted events to its own subscribers', () => {
    const session = new Session({ resourceId: 'r1', id: 's1', ownerId: 'o1', workspace: createMockWorkspace() });
    const received: HarnessEvent[] = [];
    session.subscribe(event => {
      received.push(event);
    });

    session.emit({ type: 'mode_changed', modeId: 'build', previousModeId: 'plan' });

    // The mode_changed event plus the synthetic display_state_changed fan-out.
    expect(received.map(e => e.type)).toEqual(['mode_changed', 'display_state_changed']);
  });

  it("does not deliver one session's events to another session's subscribers", () => {
    const a = new Session({ resourceId: 'a', id: 'sa', ownerId: 'oa', workspace: createMockWorkspace() });
    const b = new Session({ resourceId: 'b', id: 'sb', ownerId: 'ob', workspace: createMockWorkspace() });
    const aReceived: HarnessEvent[] = [];
    const bReceived: HarnessEvent[] = [];
    a.subscribe(event => {
      aReceived.push(event);
    });
    b.subscribe(event => {
      bReceived.push(event);
    });

    a.emit({ type: 'mode_changed', modeId: 'build', previousModeId: 'plan' });

    expect(aReceived.some(e => e.type === 'mode_changed')).toBe(true);
    expect(bReceived).toEqual([]);

    b.emit({ type: 'mode_changed', modeId: 'plan', previousModeId: 'build' });

    // a still only saw its own emit; b only saw its own.
    expect(aReceived.filter(e => e.type === 'mode_changed')).toHaveLength(1);
    expect(bReceived.some(e => e.type === 'mode_changed')).toBe(true);
  });

  it('stops delivering after unsubscribe', () => {
    const session = new Session({ resourceId: 'r1', id: 's1', ownerId: 'o1', workspace: createMockWorkspace() });
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    session.emit({ type: 'mode_changed', modeId: 'build', previousModeId: 'plan' });
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    unsubscribe();
    session.emit({ type: 'mode_changed', modeId: 'plan', previousModeId: 'build' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('routes subsystem events (state_changed) through the session bus', async () => {
    const session = new Session<{ count: number }>({
      resourceId: 'r1',
      id: 's1',
      ownerId: 'o1',
      workspace: createMockWorkspace(),
      state: { initialState: { count: 0 } },
    });
    const received: HarnessEvent[] = [];
    session.subscribe(event => {
      received.push(event);
    });

    await session.state.set({ count: 1 });

    const stateChanged = received.find(e => e.type === 'state_changed');
    expect(stateChanged).toBeDefined();
    expect((stateChanged as { state: Record<string, unknown> }).state.count).toBe(1);
  });
});
