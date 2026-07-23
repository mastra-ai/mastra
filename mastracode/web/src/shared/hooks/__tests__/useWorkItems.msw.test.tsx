import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { queryKeys } from '../../api/keys';
import type { WorkItem } from '../../../web/ui/domains/factory/services/workItems';
import { useTransitionWorkItemMutation } from '../useWorkItems';

const PROJECT_ID = 'project-1';
const ITEM_ID = 'item-1';

function item(revision: number, stage: string): WorkItem {
  return {
    id: ITEM_ID,
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: PROJECT_ID,
    source: 'github-issue',
    sourceKey: 'github-issue:1',
    parentWorkItemId: null,
    title: 'Late response test',
    url: null,
    stages: [stage],
    stageHistory: [],
    sessions: {},
    metadata: {},
    revision,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
  };
}

describe('useTransitionWorkItemMutation', () => {
  it('does not let an older accepted response overwrite a newer canonical revision', async () => {
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>(resolve => {
      releaseResponse = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items/${ITEM_ID}/transition`, async () => {
        await responseGate;
        return HttpResponse.json({
          result: {
            status: 'accepted',
            transitionId: 'transition-old',
            itemId: ITEM_ID,
            revision: 2,
            stage: 'triage',
            decisions: [],
          },
        });
      }),
    );

    const original = item(1, 'intake');
    const canonical = item(3, 'planning');
    const { result, client } = renderHookWithProviders(() => useTransitionWorkItemMutation(PROJECT_ID));
    client.setQueryData(queryKeys.workItems(PROJECT_ID), [original]);

    act(() => {
      result.current.mutate({ item: original, board: 'work', stage: 'triage' });
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));

    client.setQueryData(queryKeys.workItems(PROJECT_ID), [canonical]);
    releaseResponse();
    await waitForMutationsIdle(client);

    expect(client.getQueryData<WorkItem[]>(queryKeys.workItems(PROJECT_ID))).toEqual([canonical]);
  });

  it('exposes the destination stage of in-flight transitions and clears it on settle', async () => {
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>(resolve => {
      releaseResponse = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items/${ITEM_ID}/transition`, async () => {
        await responseGate;
        return HttpResponse.json({
          result: {
            status: 'accepted',
            transitionId: 'transition-1',
            itemId: ITEM_ID,
            revision: 2,
            stage: 'planning',
            decisions: [],
          },
        });
      }),
    );

    const original = item(1, 'triage');
    const { result, client } = renderHookWithProviders(() => useTransitionWorkItemMutation(PROJECT_ID));
    client.setQueryData(queryKeys.workItems(PROJECT_ID), [original]);

    act(() => {
      result.current.mutate({ item: original, board: 'work', stage: 'planning' });
    });
    await waitFor(() => expect(result.current.pendingTransitions).toEqual([{ itemId: ITEM_ID, stage: 'planning' }]));

    releaseResponse();
    await waitForMutationsIdle(client);
    expect(result.current.pendingTransitions).toEqual([]);
  });
});
