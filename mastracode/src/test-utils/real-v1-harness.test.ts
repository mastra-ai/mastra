import { afterEach, describe, expect, it } from 'vitest';

import { createRealV1Harness } from './real-v1-harness.js';

describe('createRealV1Harness', () => {
  let cleanups: Array<() => void> = [];

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  it('builds a real v1 harness that creates and persists a session', async () => {
    const { harness, cleanup } = createRealV1Harness<{ currentModelId?: string }>({
      stateSchema: undefined,
    });
    cleanups.push(cleanup);

    await harness.init();
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'res-1' });

    expect(session.threadId).toBe('thread-1');
    expect(session.resourceId).toBe('res-1');
    expect(session.getMode().id).toBe('default');

    // The session is real: it appears in the durable session list.
    const sessions = await harness.listSessions();
    expect(sessions.some(record => record.threadId === 'thread-1')).toBe(true);
  });

  it('persists state through a reloaded session (real durability)', async () => {
    const { harness, cleanup } = createRealV1Harness<{ note?: string }>();
    cleanups.push(cleanup);

    await harness.init();
    const session = await harness.session({ threadId: 'thread-2', resourceId: 'res-1' });
    // `setState` awaits persistence, so the durable record is committed before reload.
    await session.setState({ note: 'persisted-value' });

    // Reload the same thread: a real v1 harness reads the durable record.
    const reloaded = await harness.session({ threadId: 'thread-2', resourceId: 'res-1' });
    expect((reloaded.getState() as { note?: string }).note).toBe('persisted-value');
  });
});
