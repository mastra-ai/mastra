import { KnowledgeSequenceItems } from '@mastra/playground-ui/domains/knowledge/components/KnowledgeSequenceItems';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../test/render';
import { useKnowledgeSequence } from '../use-studio-knowledge';
import { sequencePage } from './fixtures/sequence';

function useSequence(pageId: string, requests: Parameters<typeof useKnowledgeSequence>[3]) {
  return useKnowledgeSequence('main', false, pageId, requests);
}

function Sequence() {
  return <KnowledgeSequenceItems pageId="general" useSequence={useSequence} />;
}

describe('Studio sequence pagination', () => {
  describe('when the first page refreshes after loading two more pages', () => {
    it('reanchors every loaded page without dropping displaced items', async () => {
      let refreshed = false;
      const cursors: Array<string | null> = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/knowledge/main/pages/general/sequence`, ({ request }) => {
          const cursor = new URL(request.url).searchParams.get('cursor');
          cursors.push(cursor);
          if (!cursor)
            return HttpResponse.json(
              refreshed ? sequencePage(['new', 'a'], 'shift1') : sequencePage(['a', 'b'], 'old1'),
            );
          if (cursor === 'shift1') return HttpResponse.json(sequencePage(['b', 'c'], 'shift2'));
          if (cursor === 'shift2') return HttpResponse.json(sequencePage(['d', 'e'], null));
          if (cursor === 'old1') return HttpResponse.json(sequencePage(['c', 'd'], 'old2'));
          return HttpResponse.json(sequencePage(['e'], null));
        }),
      );
      const { queryClient } = renderWithProviders(<Sequence />);
      await screen.findByText('a');
      fireEvent.click(screen.getByRole('button', { name: 'Load older items' }));
      await screen.findByText('c');
      fireEvent.click(screen.getByRole('button', { name: 'Load older items' }));
      await screen.findByText('e');
      refreshed = true;
      await act(async () => {
        await queryClient.refetchQueries({
          queryKey: ['knowledge', 'main', 'sequence', 'general', { order: 'desc' }],
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
