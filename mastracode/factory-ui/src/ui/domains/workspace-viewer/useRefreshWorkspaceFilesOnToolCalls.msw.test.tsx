import type { QueryClient } from '@tanstack/react-query';
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

function seed(client: QueryClient) {
  const keys = [
    queryKeys.workspaceTree(WORKSPACE, 'src'),
    queryKeys.workspaceFileIndex(WORKSPACE),
    queryKeys.workspaceFile(WORKSPACE, 'src/a.ts'),
    queryKeys.workspaceChanges(WORKSPACE),
    queryKeys.workspacePatches(WORKSPACE, 'branch'),
    queryKeys.workspacePatches(WORKSPACE, 'uncommitted'),
  ];
  const otherSession = queryKeys.workspaceChanges('session-2');
  for (const key of [...keys, otherSession]) client.setQueryData(key, {});
  return {
    stale: () => keys.map(key => client.getQueryState(key)?.isInvalidated),
    otherSessionStale: () => client.getQueryState(otherSession)?.isInvalidated,
  };
}

const NONE_STALE = [false, false, false, false, false, false];
const ALL_STALE = [true, true, true, true, true, true];

describe('useRefreshWorkspaceFilesOnToolCalls', () => {
  it('marks folders, the file index, the open file and every view of the changes stale when a file-changing tool finishes', () => {
    const { client, rerender } = renderHookWithProviders(
      ({ entries }) => useRefreshWorkspaceFilesOnToolCalls(WORKSPACE, entries),
      { initialProps: { entries: [] as TimelineEntry[] } },
    );
    const { stale, otherSessionStale } = seed(client);

    rerender({ entries: [toolMessage('t1', 'write_file', 'call')] });
    expect(stale()).toEqual(NONE_STALE);

    rerender({ entries: [toolMessage('t1', 'write_file', 'result')] });
    expect(stale()).toEqual(ALL_STALE);
    expect(otherSessionStale()).toBe(false);
  });

  it('treats a finished shell command as a possible file change', () => {
    const { client, rerender } = renderHookWithProviders(
      ({ entries }) => useRefreshWorkspaceFilesOnToolCalls(WORKSPACE, entries),
      { initialProps: { entries: [] as TimelineEntry[] } },
    );
    const { stale } = seed(client);

    rerender({ entries: [toolMessage('t1', 'execute_command', 'result')] });

    expect(stale()).toEqual(ALL_STALE);
  });

  it('ignores reads, and tool calls already finished when the thread opened', () => {
    const { client, rerender } = renderHookWithProviders(
      ({ entries }) => useRefreshWorkspaceFilesOnToolCalls(WORKSPACE, entries),
      { initialProps: { entries: [toolMessage('old', 'write_file', 'result')] } },
    );
    const { stale } = seed(client);

    rerender({ entries: [toolMessage('old', 'write_file', 'result'), toolMessage('t2', 'view', 'result')] });

    expect(stale()).toEqual(NONE_STALE);
  });
});
