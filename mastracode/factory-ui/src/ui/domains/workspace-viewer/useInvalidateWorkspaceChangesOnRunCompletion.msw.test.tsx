import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '../../../api/keys';
import { renderHookWithProviders } from '../../../../e2e/ui/render';
import { useInvalidateWorkspaceChangesOnRunCompletion } from './useInvalidateWorkspaceChangesOnRunCompletion';

const WORKSPACE = 'session-1';

describe('useInvalidateWorkspaceChangesOnRunCompletion', () => {
  it('invalidates workspace changes, file contents, and listed folders when the agent becomes idle', async () => {
    const { client, rerender } = renderHookWithProviders(
      ({ busy }) => useInvalidateWorkspaceChangesOnRunCompletion(WORKSPACE, busy),
      { initialProps: { busy: false } },
    );
    const changesKey = queryKeys.workspaceChanges(WORKSPACE);
    const treeKey = queryKeys.workspaceTree(WORKSPACE, 'src');
    const fileKey = queryKeys.workspaceFile(WORKSPACE, 'src/agent.ts');
    client.setQueryData(changesKey, { workspacePath: WORKSPACE, available: true, changes: [] });
    client.setQueryData(treeKey, { workspacePath: WORKSPACE, path: 'src', available: true, entries: [] });
    client.setQueryData(fileKey, { workspacePath: WORKSPACE, path: 'src/agent.ts' });

    rerender({ busy: true });
    rerender({ busy: false });

    await waitFor(() => {
      expect(client.getQueryState(changesKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(treeKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(fileKey)?.isInvalidated).toBe(true);
    });
  });
});
