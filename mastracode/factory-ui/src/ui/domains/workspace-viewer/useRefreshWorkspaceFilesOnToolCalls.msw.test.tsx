import type { QueryClient, QueryKey } from '@tanstack/react-query';
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
  const shown = [queryKeys.workspaceTree(WORKSPACE, 'src'), queryKeys.workspaceFile(WORKSPACE, 'src/a.ts')];
  const leftForLater = [
    queryKeys.workspaceFileIndex(WORKSPACE),
    queryKeys.workspaceChanges(WORKSPACE),
    queryKeys.workspacePatches(WORKSPACE, 'branch'),
    queryKeys.workspacePatches(WORKSPACE, 'uncommitted'),
  ];
  for (const key of [...shown, ...leftForLater]) client.setQueryData(key, {});
  const stale = (keys: readonly QueryKey[]) => keys.map(key => client.getQueryState(key)?.isInvalidated);
  return { shownStale: () => stale(shown), leftForLaterStale: () => stale(leftForLater) };
}

const SHOWN_FRESH = [false, false];
const SHOWN_STALE = [true, true];
const LEFT_FRESH = [false, false, false, false];

describe('useRefreshWorkspaceFilesOnToolCalls', () => {
  it('marks the folders and the open file stale when a file-changing tool finishes, and leaves the file index and the changes for later', () => {
    const { client, rerender } = renderHookWithProviders(
      ({ entries }) => useRefreshWorkspaceFilesOnToolCalls(WORKSPACE, entries),
      { initialProps: { entries: [] as TimelineEntry[] } },
    );
    const { shownStale, leftForLaterStale } = seed(client);

    rerender({ entries: [toolMessage('t1', 'write_file', 'call')] });
    expect(shownStale()).toEqual(SHOWN_FRESH);

    rerender({ entries: [toolMessage('t1', 'write_file', 'result')] });
    expect(shownStale()).toEqual(SHOWN_STALE);
    expect(leftForLaterStale()).toEqual(LEFT_FRESH);
  });

  it('treats a finished shell command as a possible file change', () => {
    const { client, rerender } = renderHookWithProviders(
      ({ entries }) => useRefreshWorkspaceFilesOnToolCalls(WORKSPACE, entries),
      { initialProps: { entries: [] as TimelineEntry[] } },
    );
    const { shownStale } = seed(client);

    rerender({ entries: [toolMessage('t1', 'execute_command', 'result')] });

    expect(shownStale()).toEqual(SHOWN_STALE);
  });

  it('ignores reads, and tool calls already finished when the thread opened', () => {
    const { client, rerender } = renderHookWithProviders(
      ({ entries }) => useRefreshWorkspaceFilesOnToolCalls(WORKSPACE, entries),
      { initialProps: { entries: [toolMessage('old', 'write_file', 'result')] } },
    );
    const { shownStale } = seed(client);

    rerender({ entries: [toolMessage('old', 'write_file', 'result'), toolMessage('t2', 'view', 'result')] });

    expect(shownStale()).toEqual(SHOWN_FRESH);
  });
});
