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

function toolStart(toolCallId: string, toolName: string): AgentControllerEvent {
  return { type: 'tool_start', toolCallId, toolName, args: {} };
}

function toolEnd(toolCallId: string, isError = false): AgentControllerEvent {
  return { type: 'tool_end', toolCallId, result: null, isError };
}

function toolEndDenied(toolCallId: string, reason = 'user declined'): AgentControllerEvent {
  return { type: 'tool_end', toolCallId, result: reason, isError: false, denied: true };
}

describe('observeSessionFirstExec', () => {
  it('marks the first exec on the first successful workspace tool_end and unsubscribes', () => {
    const { session, listeners, emit } = createSession();
    const dependencies = createDependencies();
    observeSessionFirstExec(session, dependencies);

    emit(toolStart('call-1', 'mastra_workspace_read_file'));
    emit(toolEnd('call-1'));

    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'resource-1',
    });
    expect(listeners).toHaveLength(0);
  });

  it('accepts post-remap mastracode tool names (view, execute_command, search_content)', () => {
    for (const toolName of ['view', 'execute_command', 'search_content', 'string_replace_lsp']) {
      const { session, emit } = createSession();
      const dependencies = createDependencies();
      observeSessionFirstExec(session, dependencies);

      emit(toolStart('call-1', toolName));
      emit(toolEnd('call-1'));

      expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).toHaveBeenCalledTimes(1);
    }
  });

  it('ignores non-workspace tools (memory, notifications, subagent)', () => {
    const { session, emit } = createSession();
    const dependencies = createDependencies();
    observeSessionFirstExec(session, dependencies);

    for (const toolName of ['updateWorkingMemory', 'notification_inbox', 'subagent', 'random_custom_tool']) {
      emit(toolStart(`call-${toolName}`, toolName));
      emit(toolEnd(`call-${toolName}`));
    }

    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).not.toHaveBeenCalled();
  });

  it('stays subscribed past failed tool calls and marks on the first success only', () => {
    const { session, emit } = createSession();
    const dependencies = createDependencies();
    observeSessionFirstExec(session, dependencies);

    emit({ type: 'agent_start' });
    emit(toolStart('call-1', 'execute_command'));
    emit(toolEnd('call-1', true));
    emit(toolStart('call-2', 'view'));
    emit(toolEnd('call-2', true));
    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).not.toHaveBeenCalled();

    emit(toolStart('call-3', 'mastra_workspace_grep'));
    emit(toolEnd('call-3'));
    emit(toolStart('call-4', 'view'));
    emit(toolEnd('call-4'));
    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).toHaveBeenCalledTimes(1);
  });

  it('ignores approval-denied and abort-while-parked tool_end events (denied: true)', () => {
    const { session, emit } = createSession();
    const dependencies = createDependencies();
    observeSessionFirstExec(session, dependencies);

    // Mirrors SessionRunEngine's tool-output-denied path: tool_start, then a
    // tool_end with isError=false but denied=true and the denial reason as result.
    emit(toolStart('call-1', 'execute_command'));
    emit(toolEndDenied('call-1', 'user declined the shell command'));

    // And the abort-while-parked path (settleToolCallAsDenied): same shape.
    emit(toolStart('call-2', 'write_file'));
    emit(toolEndDenied('call-2', 'ABORTED_BY_USER'));

    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).not.toHaveBeenCalled();

    // A subsequent real successful workspace tool still stamps.
    emit(toolStart('call-3', 'view'));
    emit(toolEnd('call-3'));
    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).toHaveBeenCalledTimes(1);
  });

  it('drops in-flight tool_start entries on agent_end so aborted runs do not leak state', () => {
    const { session, emit } = createSession();
    const dependencies = createDependencies();
    observeSessionFirstExec(session, dependencies);

    // Simulate several runs that abort before their tool calls complete.
    for (let i = 0; i < 3; i++) {
      emit(toolStart(`aborted-${i}`, 'view'));
      emit({ type: 'agent_end', reason: 'aborted' });
    }

    // A stray, delayed tool_end for one of the aborted call IDs must not
    // resurrect a meaningful-exec stamp: the toolName lookup should be gone.
    emit({ type: 'tool_end', toolCallId: 'aborted-0', result: null, isError: false });
    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).not.toHaveBeenCalled();

    // A fresh, real run with a matching start/end pair still stamps.
    emit(toolStart('call-live', 'search_content'));
    emit(toolEnd('call-live'));
    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).toHaveBeenCalledTimes(1);
  });

  it('preserves genuinely suspended tool calls across agent_end and clears cancelled suspensions', () => {
    const { session, emit } = createSession();
    const dependencies = createDependencies();
    observeSessionFirstExec(session, dependencies);

    // A tool that suspends mid-run: agent_end fires with reason 'suspended',
    // and the eventual resumed tool_end must still resolve its tool name.
    emit(toolStart('call-suspended', 'execute_command'));
    emit({
      type: 'tool_suspended',
      toolCallId: 'call-suspended',
      toolName: 'execute_command',
      args: {},
      suspendPayload: null,
    });
    emit({ type: 'agent_end', reason: 'suspended' });

    // A cancelled suspension must be evicted so it doesn't linger forever.
    emit(toolStart('call-cancelled', 'view'));
    emit({
      type: 'tool_suspended',
      toolCallId: 'call-cancelled',
      toolName: 'view',
      args: {},
      suspendPayload: null,
    });
    emit({
      type: 'tool_suspension_cancelled',
      toolCallId: 'call-cancelled',
      toolName: 'view',
      reason: 'user cancelled',
    });
    // Late stray tool_end for the cancelled ID must not stamp.
    emit(toolEnd('call-cancelled'));
    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).not.toHaveBeenCalled();

    // Resumed suspended call still stamps because its toolName was preserved.
    emit(toolEnd('call-suspended'));
    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).toHaveBeenCalledTimes(1);
  });

  it('warns instead of throwing when the storage write fails', async () => {
    const { session, emit } = createSession();
    const dependencies = createDependencies();
    dependencies.sourceControl.sessions.markFirstMeaningfulExec = vi.fn().mockRejectedValue(new Error('db down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    observeSessionFirstExec(session, dependencies);

    emit(toolStart('call-1', 'view'));
    emit(toolEnd('call-1'));
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

    emit(toolStart('call-1', 'view'));
    emit(toolEnd('call-1'));
    expect(dependencies.sourceControl.sessions.markFirstMeaningfulExec).not.toHaveBeenCalled();
  });
});
