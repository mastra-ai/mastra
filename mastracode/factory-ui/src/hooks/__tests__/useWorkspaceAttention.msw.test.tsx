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
const workspaceIds = [workSessionId, reviewSessionId];

function useActivityAttention({ resourceId, workspaceIds }: { resourceId: string; workspaceIds: string[] }) {
  const runningByPath = useWorkspaceActivity({
    agentControllerId: controllerId,
    resourceId,
    workspaceIds,
    baseUrl: TEST_BASE_URL,
    enabled: true,
  });
  return { runningByPath, ...useWorkspaceAttention(runningByPath) };
}

function stubActiveWorkRun() {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/active-runs`, () =>
      HttpResponse.json({ runs: [{ runId: 'run-1', resourceId: workSessionId, threadId: workSessionId }] }),
    ),
  );
}

describe('workspace completion state', () => {
  describe('when the user switches to another session while a run remains active', () => {
    it('keeps the run active without requesting attention', async () => {
      stubActiveWorkRun();

      const { result, rerender } = renderHookWithProviders(props => useActivityAttention(props), {
        initialProps: { resourceId: workSessionId, workspaceIds },
      });

      await waitFor(() => expect(result.current.runningByPath[workSessionId]).toBe(true));

      rerender({ resourceId: reviewSessionId, workspaceIds });

      await waitFor(() => expect(result.current.runningByPath[reviewSessionId]).toBe(false));
      expect(result.current.runningByPath[workSessionId]).toBe(true);
      expect(result.current.attentionByPath[workSessionId]).not.toBe(true);
    });
  });

  describe('when a workspace appears while a run remains active', () => {
    it('keeps the run active without requesting attention', async () => {
      stubActiveWorkRun();
      const extraSessionId = 'session-extra';

      const { result, rerender } = renderHookWithProviders(props => useActivityAttention(props), {
        initialProps: { resourceId: workSessionId, workspaceIds },
      });

      await waitFor(() => expect(result.current.runningByPath[workSessionId]).toBe(true));

      rerender({ resourceId: workSessionId, workspaceIds: [...workspaceIds, extraSessionId] });

      expect(result.current.runningByPath[workSessionId]).toBe(true);
      await waitFor(() => expect(result.current.runningByPath[extraSessionId]).toBe(false));
      expect(result.current.runningByPath[workSessionId]).toBe(true);
      expect(result.current.attentionByPath[workSessionId]).not.toBe(true);
    });
  });
});
