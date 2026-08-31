import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { agentVersionQueryKeys } from '../agent-version-query-keys';
import { useAllAgentVersions } from '../use-agent-versions';
import {
  firstAgentVersionPage,
  PAGINATED_AGENT_VERSION_ID,
  secondAgentVersionPageWithDuplicate,
} from './fixtures/agent-version-history';
import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL } from '@/test/render';

describe('useAllAgentVersions', () => {
  describe('when more than one page exists and a page repeats its boundary version', () => {
    it('returns every unique version in first-seen server order', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/stored/agents/${PAGINATED_AGENT_VERSION_ID}/versions`, ({ request }) => {
          const page = Number(new URL(request.url).searchParams.get('page'));
          return HttpResponse.json(page === 0 ? firstAgentVersionPage : secondAgentVersionPageWithDuplicate);
        }),
      );
      const { wrapper, queryClient } = makeWrapper();

      const { result } = renderHook(
        () =>
          useAllAgentVersions({
            agentId: PAGINATED_AGENT_VERSION_ID,
            params: { orderBy: { direction: 'DESC' } },
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.versions).toHaveLength(25);
      expect(result.current.data?.versions.map(version => version.versionNumber)).toEqual(
        Array.from({ length: 25 }, (_, index) => 25 - index),
      );
      expect(result.current.data).toMatchObject({ total: 25, page: 0, perPage: false, hasMore: false });
      expect(
        queryClient.getQueryCache().findAll({
          queryKey: agentVersionQueryKeys.versionLists(PAGINATED_AGENT_VERSION_ID),
        }),
      ).toHaveLength(1);
    });

    it('requests zero-based pages with the complete-query page size and preserves ordering parameters', async () => {
      const requests: string[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/stored/agents/${PAGINATED_AGENT_VERSION_ID}/versions`, ({ request }) => {
          requests.push(request.url);
          const page = Number(new URL(request.url).searchParams.get('page'));
          return HttpResponse.json(page === 0 ? firstAgentVersionPage : secondAgentVersionPageWithDuplicate);
        }),
      );
      const { wrapper } = makeWrapper();

      const { result } = renderHook(
        () =>
          useAllAgentVersions({
            agentId: PAGINATED_AGENT_VERSION_ID,
            params: { orderBy: { field: 'versionNumber', direction: 'DESC' } },
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(
        requests.map(request => {
          const url = new URL(request);
          return {
            page: url.searchParams.get('page'),
            perPage: url.searchParams.get('perPage'),
            field: url.searchParams.get('orderBy[field]'),
            direction: url.searchParams.get('orderBy[direction]'),
          };
        }),
      ).toEqual([
        { page: '0', perPage: '20', field: 'versionNumber', direction: 'DESC' },
        { page: '1', perPage: '20', field: 'versionNumber', direction: 'DESC' },
      ]);
    });
  });
});
