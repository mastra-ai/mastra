import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { useWorkspaceActivity } from '../useWorkspaceActivity';
import { useWorkspaceAttention } from '../useWorkspaceAttention';

const controllerId = 'code';
const workSessionId = 'session-work';
const reviewSessionId = 'session-review';
const worktreePaths = [workSessionId, reviewSessionId];

function useActivityAttention(resourceId: string) {
  const runningByPath = useWorkspaceActivity({
    agentControllerId: controllerId,
    resourceId,
    workspaceIds: worktreePaths,
    baseUrl: TEST_BASE_URL,
    enabled: true,
  });
  return { runningByPath, ...useWorkspaceAttention(runningByPath) };
}

describe('workspace completion state', () => {
  describe('when the user switches to another session while a run remains active', () => {
    it('keeps the run active without requesting attention', async () => {
      server.use(
        http.get(
          `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/:resourceId/threads`,
          ({ request }) => {
            expect(new URL(request.url).searchParams.getAll('resourceIds')).toEqual(worktreePaths);
            return HttpResponse.json({
              threads: [
                {
                  id: workSessionId,
                  resourceId: workSessionId,
                  title: 'Implement loader',
                  tags: { factorySessionId: workSessionId },
                  state: 'active',
                },
                {
                  id: reviewSessionId,
                  resourceId: reviewSessionId,
                  title: 'Review loader',
                  tags: { factorySessionId: reviewSessionId },
                  state: 'idle',
                },
              ],
            });
          },
        ),
      );

      const { result, rerender } = renderHookWithProviders(({ resourceId }) => useActivityAttention(resourceId), {
        initialProps: { resourceId: workSessionId },
      });

      await waitFor(() => expect(result.current.runningByPath[workSessionId]).toBe(true));

      rerender({ resourceId: reviewSessionId });

      await waitFor(() => expect(result.current.runningByPath[reviewSessionId]).toBe(false));
      expect(result.current.runningByPath[workSessionId]).toBe(true);
      expect(result.current.attentionByPath[workSessionId]).not.toBe(true);
    });
  });
});
