/**
 * BDD coverage for the board's column order: the board decides it, not the list
 * endpoint. Cards come back newest-first whatever order the server sends, so a
 * sync or a run touching a card cannot move it under the reader.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { useBoardItems } from '../useBoardItems';

const factoryProjectId = 'fp-1';

function issueCard(id: string, createdAt: string) {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId,
    externalSource: { integrationId: 'github', type: 'issue', externalId: id },
    parentWorkItemId: null,
    title: id,
    stages: ['triage'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    revision: 1,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('useBoardItems column order', () => {
  it('orders cards newest-first regardless of the order the list endpoint sends', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryProjectId}/work-items`, () =>
        HttpResponse.json({
          workItems: [
            issueCard('middle', '2026-07-23T10:00:00.000Z'),
            issueCard('oldest', '2026-07-23T09:00:00.000Z'),
            issueCard('newest', '2026-07-23T11:00:00.000Z'),
          ],
        }),
      ),
    );

    const { result } = renderHookWithProviders(() => useBoardItems({ factoryProjectId, kind: 'work' }));

    await waitFor(() => expect(result.current.visible).toHaveLength(3));
    expect(result.current.visible.map(item => item.id)).toEqual(['newest', 'middle', 'oldest']);
  });
});
