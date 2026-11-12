/**
 * The board catalog is read straight from the query cache too (route loaders, factory creation),
 * not only through `useBoardCatalog`. A server older than the catalog's `flow` must read the same
 * way on every path.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { workBoardInfo } from '../../../e2e/ui/board-catalog';
import { server } from '../../../e2e/ui/msw-server';
import { TEST_API, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createQueryClient } from '../../query-client';
import { boardCatalogQueryOptions } from '../useBoardCatalog';

describe('board catalog query', () => {
  it("gives a reader of the cached catalog Work's loop from a server older than the board loop", async () => {
    const { flow: _flow, ...olderWork } = workBoardInfo;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/:id/boards`, () => HttpResponse.json({ boards: [olderWork] })),
    );

    const { boards } = await createQueryClient().fetchQuery(boardCatalogQueryOptions(TEST_API.client, 'factory-1'));

    expect(boards[0]?.flow).toMatchObject({ triage: 'triage', build: 'execute', pullRequestReview: 'pr-review' });
  });
});
