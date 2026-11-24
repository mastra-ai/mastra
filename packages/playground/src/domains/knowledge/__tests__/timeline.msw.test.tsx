import { KnowledgeTimelineEntries } from '@mastra/playground-ui/domains/knowledge/components/KnowledgeTimelineEntries';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../test/render';
import { useKnowledgeTimeline } from '../use-studio-knowledge';
import { timelinePage } from './fixtures/timeline';

function useTimeline(pageId: string, requests: Parameters<typeof useKnowledgeTimeline>[3]) {
  return useKnowledgeTimeline('main', false, pageId, requests);
}

function Timeline() {
  return <KnowledgeTimelineEntries pageId="general" useTimeline={useTimeline} />;
}

describe('Studio timeline pagination', () => {
  describe('when the first page refreshes after loading two more pages', () => {
    it('reanchors every loaded page without dropping displaced entries', async () => {
      let refreshed = false;
      const cursors: Array<string | null> = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/knowledge/main/pages/general/timeline`, ({ request }) => {
          const cursor = new URL(request.url).searchParams.get('cursor');
          cursors.push(cursor);
          if (!cursor)
            return HttpResponse.json(
              refreshed ? timelinePage(['new', 'a'], 'shift1') : timelinePage(['a', 'b'], 'old1'),
            );
          if (cursor === 'shift1') return HttpResponse.json(timelinePage(['b', 'c'], 'shift2'));
          if (cursor === 'shift2') return HttpResponse.json(timelinePage(['d', 'e'], null));
          if (cursor === 'old1') return HttpResponse.json(timelinePage(['c', 'd'], 'old2'));
          return HttpResponse.json(timelinePage(['e'], null));
        }),
      );
      const { queryClient } = renderWithProviders(<Timeline />);
      await screen.findByText('a');
      fireEvent.click(screen.getByRole('button', { name: 'Load older entries' }));
      await screen.findByText('c');
      fireEvent.click(screen.getByRole('button', { name: 'Load older entries' }));
      await screen.findByText('e');
      refreshed = true;
      await act(async () => {
        await queryClient.refetchQueries({
          queryKey: ['knowledge', 'main', 'timeline', 'general', { order: 'desc' }],
          exact: true,
        });
      });
      await waitFor(() => {
        for (const id of ['new', 'a', 'b', 'c', 'd', 'e']) expect(screen.getByText(id)).toBeTruthy();
        expect(queryClient.isFetching()).toBe(0);
      });
      expect(cursors).toContain('shift1');
      expect(cursors).toContain('shift2');
    });
  });
});
