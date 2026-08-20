import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '../../../api/keys';
import { renderHookWithProviders } from '../../../../e2e/ui/render';
import { useInvalidateWorkspaceChangesOnRunCompletion } from './useInvalidateWorkspaceChangesOnRunCompletion';

const WORKSPACE = 'session-1';
const THREAD = 'thread-1';

describe('useInvalidateWorkspaceChangesOnRunCompletion', () => {
  it('invalidates workspace changes, file contents, and persisted files when the agent becomes idle', async () => {
    const { client, rerender } = renderHookWithProviders(
      ({ busy }) => useInvalidateWorkspaceChangesOnRunCompletion(WORKSPACE, THREAD, busy),
      { initialProps: { busy: false } },
    );
    const changesKey = queryKeys.workspaceChanges(WORKSPACE);
    const filesKey = queryKeys.workspaceFiles(WORKSPACE, THREAD);
    const fileKey = queryKeys.workspaceFile(WORKSPACE, 'src/agent.ts', THREAD);
    client.setQueryData(changesKey, { workspacePath: WORKSPACE, available: true, changes: [] });
    client.setQueryData(filesKey, { workspacePath: WORKSPACE, threadId: THREAD, files: [] });
    client.setQueryData(fileKey, { workspacePath: WORKSPACE, path: 'src/agent.ts' });

    rerender({ busy: true });
    rerender({ busy: false });

    await waitFor(() => {
      expect(client.getQueryState(changesKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(filesKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(fileKey)?.isInvalidated).toBe(true);
    });
  });
});
