import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { useActiveRunResources } from '../useActiveRunResources';
import { useWorkspaceAttention } from '../useWorkspaceAttention';

const controllerId = 'code';
const workSessionId = 'session-work';
const reviewSessionId = 'session-review';
const workspaceIds = [workSessionId, reviewSessionId];

function useActivityAttention({ workspaceIds }: { workspaceIds: string[] }) {
  const runningByPath = useActiveRunResources({
    agentControllerId: controllerId,
    resourceIds: workspaceIds,
  });
  return {
    runningByPath,
    ...useWorkspaceAttention({
      projectRepositoryId: 'repository-1',
      sessionKind: 'factory',
      runningByPath,
      ready: true,
    }),
  };
}

describe('workspace completion state', () => {
  describe('when a workspace appears while a run remains active', () => {
    it('keeps the run active without requesting attention', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/active-runs`, () =>
          HttpResponse.json({ runs: [{ runId: 'run-1', resourceId: workSessionId, threadId: workSessionId }] }),
        ),
      );
      const extraSessionId = 'session-extra';

      const { result, rerender } = renderHookWithProviders(props => useActivityAttention(props), {
        initialProps: { workspaceIds },
      });

      await waitFor(() => expect(result.current.runningByPath[workSessionId]).toBe(true));

      rerender({ workspaceIds: [...workspaceIds, extraSessionId] });

      await waitFor(() => expect(result.current.runningByPath[extraSessionId]).toBe(false));
      expect(result.current.runningByPath[workSessionId]).toBe(true);
      expect(result.current.attentionByPath[workSessionId]).not.toBe(true);
    });
  });
});
