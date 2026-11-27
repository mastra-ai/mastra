import { KnowledgeSequenceItems } from '@mastra/playground-ui/domains/knowledge/components/KnowledgeSequenceItems';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../../test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../test/render';
import { useKnowledgeSequence } from '../use-studio-knowledge';
import { sequenceItem, sequencePage, timelineInfo } from './fixtures/sequence';

function useSequence(pageId: string, requests: Parameters<typeof useKnowledgeSequence>[3]) {
  return useKnowledgeSequence('main', false, pageId, requests);
}

function Sequence({
  info = timelineInfo,
  onOpenPage,
}: {
  info?: typeof timelineInfo;
  onOpenPage?: (pageId: string) => void;
}) {
  return <KnowledgeSequenceItems pageId="general" info={info} useSequence={useSequence} onOpenPage={onOpenPage} />;
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
          queryKey: ['knowledge', 'main', 'sequence', 'general', {}],
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

  describe('when the sequence orders by position and declares item types', () => {
    it('sends type filters, drops the date range and opens child pages', async () => {
      const queries: string[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/knowledge/main/pages/general/sequence`, ({ request }) => {
          queries.push(new URL(request.url).search);
          return HttpResponse.json({
            items: [
              sequenceItem('s1', {
                occurredAt: null,
                position: 'a',
                body: null,
                title: 'Check the order',
                type: 'step',
              }),
              sequenceItem('page:approve', {
                occurredAt: null,
                position: 'b',
                body: null,
                title: 'Approve the refund',
                pageId: 'approve',
              }),
            ],
            nextCursor: null,
          });
        }),
      );
      const onOpenPage = vi.fn();
      renderWithProviders(
        <Sequence
          info={{ orderBy: 'position', propertiesSchema: null, itemTypes: { step: { label: 'Step' } } }}
          onOpenPage={onOpenPage}
        />,
      );
      await screen.findByText('Check the order');
      expect(screen.queryByLabelText('From')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Step' }));
      await waitFor(() => expect(queries.at(-1)).toBe('?type=step'));
      fireEvent.click(screen.getByRole('button', { name: 'Untyped' }));
      await waitFor(() => expect(queries.at(-1)).toBe('?untyped=true'));
      fireEvent.click(await screen.findByRole('button', { name: 'Approve the refund' }));
      expect(onOpenPage).toHaveBeenCalledWith('approve');
      expect(queries[0]).toBe('');
    });
  });
});
