import { describe, expect, it } from 'vitest';

import { queryKeys } from '../../../api/keys';
import { renderHookWithProviders } from '../../../../e2e/ui/render';
import type { TimelineEntry } from '../chat/services/transcript';
import { useRefreshWorkspaceFilesOnToolCalls } from './useRefreshWorkspaceFilesOnToolCalls';

const WORKSPACE = 'session-1';

function toolMessage(id: string, toolName: string, state: 'call' | 'result'): TimelineEntry {
  return {
    kind: 'message',
    id: `message-${id}`,
    message: {
      id: `message-${id}`,
      role: 'assistant',
      createdAt: new Date(0),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation:
              state === 'result'
                ? { state, toolCallId: id, toolName, args: { path: 'src/a.ts' }, result: 'ok' }
                : { state, toolCallId: id, toolName, args: { path: 'src/a.ts' } },
          },
        ],
      },
    },
  };
}

function seed(client: ReturnType<typeof renderHookWithProviders>['client']) {
  const treeKey = queryKeys.workspaceTree(WORKSPACE, 'src');
  const fileKey = queryKeys.workspaceFile(WORKSPACE, 'src/a.ts');
  client.setQueryData(treeKey, { workspacePath: WORKSPACE, path: 'src', available: true, entries: [] });
  client.setQueryData(fileKey, { workspacePath: WORKSPACE, path: 'src/a.ts' });
  return {
    stale: () => [client.getQueryState(treeKey)?.isInvalidated, client.getQueryState(fileKey)?.isInvalidated],
  };
}

describe('useRefreshWorkspaceFilesOnToolCalls', () => {
  it('marks folders and the open file stale when a file-changing tool finishes', () => {
    const { client, rerender } = renderHookWithProviders(
      ({ entries }) => useRefreshWorkspaceFilesOnToolCalls(WORKSPACE, entries),
      { initialProps: { entries: [] as TimelineEntry[] } },
    );
    const { stale } = seed(client);

    rerender({ entries: [toolMessage('t1', 'write_file', 'call')] });
    expect(stale()).toEqual([false, false]);

    rerender({ entries: [toolMessage('t1', 'write_file', 'result')] });
    expect(stale()).toEqual([true, true]);
  });

  it('treats a finished shell command as a possible file change', () => {
    const { client, rerender } = renderHookWithProviders(
      ({ entries }) => useRefreshWorkspaceFilesOnToolCalls(WORKSPACE, entries),
      { initialProps: { entries: [] as TimelineEntry[] } },
    );
    const { stale } = seed(client);

    rerender({ entries: [toolMessage('t1', 'execute_command', 'result')] });

    expect(stale()).toEqual([true, true]);
  });

  it('ignores reads, and tool calls already finished when the thread opened', () => {
    const { client, rerender } = renderHookWithProviders(
      ({ entries }) => useRefreshWorkspaceFilesOnToolCalls(WORKSPACE, entries),
      { initialProps: { entries: [toolMessage('old', 'write_file', 'result')] } },
    );
    const { stale } = seed(client);

    rerender({ entries: [toolMessage('old', 'write_file', 'result'), toolMessage('t2', 'view', 'result')] });

    expect(stale()).toEqual([false, false]);
  });

  it('marks the process list and output stale when a process tool finishes, without touching files', () => {
    const { client, rerender } = renderHookWithProviders(
      ({ entries }) => useRefreshWorkspaceFilesOnToolCalls(WORKSPACE, entries),
      { initialProps: { entries: [] as TimelineEntry[] } },
    );
    const { stale } = seed(client);
    const listKey = queryKeys.workspaceProcesses(WORKSPACE);
    const outputKey = queryKeys.workspaceProcess(WORKSPACE, '7');
    client.setQueryData(listKey, { workspacePath: WORKSPACE, available: true, supported: true, processes: [] });
    client.setQueryData(outputKey, { stdout: '', stderr: '' });
    const processesStale = () => [
      client.getQueryState(listKey)?.isInvalidated,
      client.getQueryState(outputKey)?.isInvalidated,
    ];

    rerender({ entries: [toolMessage('t1', 'kill_process', 'result')] });

    expect(processesStale()).toEqual([true, true]);
    expect(stale()).toEqual([false, false]);
  });
});
