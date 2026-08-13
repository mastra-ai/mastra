import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

import {
  observeSessionFirstExec,
  type FirstExecCaptureDependencies,
  type FirstExecCaptureSession,
} from './first-exec-capture.js';

function createSession() {
  const listeners: Array<(event: AgentControllerEvent) => void> = [];
  const session: FirstExecCaptureSession = {
    identity: { getResourceId: () => 'resource-1' },
    subscribe: listener => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
  };
  const emit = (event: AgentControllerEvent) => {
    for (const listener of [...listeners]) listener(event);
  };
  return { session, listeners, emit };
}

function createDependencies(): FirstExecCaptureDependencies {
  return {
    sourceControl: { sessions: { markFirstMeaningfulExec: vi.fn().mockResolvedValue(undefined) } },
  };
}

describe('observeSessionFirstExec', () => {
  it('marks the first exec on the first successful command_exit and unsubscribes', () => {
    const { session, listeners, emit } = createSession();
    const dependencies = createDependencies();
    observeSessionFirstExec(session, dependencies);

    emit({ type: 'command_exit', toolCallId: 'call-1', exitCode: 0, success: true });

    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'resource-1',
    });
    expect(listeners).toHaveLength(0);
  });

  it('stays subscribed past failed commands and marks on the first success only', () => {
    const { session, emit } = createSession();
    const dependencies = createDependencies();
    observeSessionFirstExec(session, dependencies);

    emit({ type: 'agent_start' });
    emit({ type: 'command_exit', toolCallId: 'call-1', exitCode: 1, success: false });
    emit({ type: 'command_exit', toolCallId: 'call-2', exitCode: 127, success: false });
    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).not.toHaveBeenCalled();

    emit({ type: 'command_exit', toolCallId: 'call-3', exitCode: 0, success: true });
    emit({ type: 'command_exit', toolCallId: 'call-4', exitCode: 0, success: true });
    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).toHaveBeenCalledTimes(1);
  });

  it('warns instead of throwing when the storage write fails', async () => {
    const { session, emit } = createSession();
    const dependencies = createDependencies();
    dependencies.sourceControl.sessions.markFirstMeaningfulExec = vi.fn().mockRejectedValue(new Error('db down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    observeSessionFirstExec(session, dependencies);

    emit({ type: 'command_exit', toolCallId: 'call-1', exitCode: 0, success: true });
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        '[Factory first-exec capture] Unable to persist first exec time.',
        expect.any(Error),
      ),
    );
    warn.mockRestore();
  });

  it('stops observing when the returned unsubscribe is called before any exec', () => {
    const { session, listeners, emit } = createSession();
    const dependencies = createDependencies();
    const unsubscribe = observeSessionFirstExec(session, dependencies);

    unsubscribe();
    expect(listeners).toHaveLength(0);

    emit({ type: 'command_exit', toolCallId: 'call-1', exitCode: 0, success: true });
    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).not.toHaveBeenCalled();
  });
});
