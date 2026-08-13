import type { SessionBeforeAgentEndListener } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

import { observeSessionCheckpoint, type CheckpointCaptureSession } from './checkpoint-capture.js';

function createSession(snapshot = vi.fn<() => Promise<void>>(async () => {})) {
  const listeners: SessionBeforeAgentEndListener[] = [];
  const session: CheckpointCaptureSession = {
    getWorkspace: () => ({ sandbox: { snapshot } }),
    onBeforeAgentEnd: listener => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
  };

  return { session, snapshot, listeners };
}

describe('observeSessionCheckpoint', () => {
  it.each(['complete', 'aborted', 'error', 'suspended'] as const)(
    'snapshots before %s agent-end events',
    async reason => {
      const { session, snapshot, listeners } = createSession();
      observeSessionCheckpoint(session);

      await listeners[0]!({ type: 'agent_end', reason });

      expect(snapshot).toHaveBeenCalledTimes(1);
    },
  );

  it('skips snapshotting when the session has no workspace sandbox', async () => {
    const { listeners } = createSession();
    const session: CheckpointCaptureSession = {
      getWorkspace: () => undefined,
      onBeforeAgentEnd: listener => {
        listeners.push(listener);
        return () => {};
      },
    };
    observeSessionCheckpoint(session);

    await expect(listeners[0]!({ type: 'agent_end', reason: 'complete' })).resolves.toBeUndefined();
  });

  it('skips sandboxes that do not implement snapshot', async () => {
    const { listeners } = createSession();
    const session: CheckpointCaptureSession = {
      getWorkspace: () => ({ sandbox: {} as { snapshot(): Promise<void> } }),
      onBeforeAgentEnd: listener => {
        listeners.push(listener);
        return () => {};
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    observeSessionCheckpoint(session);

    await expect(listeners[0]!({ type: 'agent_end', reason: 'complete' })).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('logs and swallows snapshot failures', async () => {
    const failure = new Error('snapshot unavailable');
    const { session, listeners } = createSession(vi.fn().mockRejectedValue(failure));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    observeSessionCheckpoint(session);

    await expect(listeners[0]!({ type: 'agent_end', reason: 'complete' })).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('[Factory checkpoint capture] Unable to snapshot sandbox.', failure);
    warn.mockRestore();
  });

  it('serializes snapshots when terminal events arrive before the prior snapshot finishes', async () => {
    let completeFirstSnapshot: (() => void) | undefined;
    const snapshot = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>(resolve => {
            completeFirstSnapshot = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const { session, listeners } = createSession(snapshot);
    observeSessionCheckpoint(session);

    const first = listeners[0]!({ type: 'agent_end', reason: 'complete' });
    await vi.waitFor(() => expect(snapshot).toHaveBeenCalledTimes(1));

    const second = listeners[0]!({ type: 'agent_end', reason: 'complete' });
    await Promise.resolve();
    expect(snapshot).toHaveBeenCalledTimes(1);

    completeFirstSnapshot?.();
    await first;
    await second;
    expect(snapshot).toHaveBeenCalledTimes(2);
  });

  it('stops snapshotting after unsubscribe', async () => {
    const { session, snapshot, listeners } = createSession();
    const unsubscribe = observeSessionCheckpoint(session);

    unsubscribe();
    expect(listeners).toHaveLength(0);
    expect(snapshot).not.toHaveBeenCalled();
  });
});
