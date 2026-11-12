// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { buildDataset, buildListDatasetsResponse } from '../../datasets/components/__tests__/fixtures/datasets';
import { buildReplayCreated, buildReplayPreview } from './__tests__/fixtures/replay';
import { CreateReplayDatasetDialog } from './create-replay-dataset-dialog';
import { server } from '@/test/msw-server';

const base = 'http://localhost:4111/api';
function setup(turnCount = 10) {
  const previews: unknown[] = [];
  const created: unknown[] = [];
  const inserted: unknown[] = [];
  const listed: string[] = [];
  server.use(
    http.get(`${base}/datasets`, ({ request }) => {
      listed.push(new URL(request.url).search);
      return HttpResponse.json(buildListDatasetsResponse([]));
    }),
    http.post(`${base}/datasets/replay/preview`, async ({ request }) => {
      previews.push(await request.json());
      return HttpResponse.json(buildReplayPreview(turnCount));
    }),
    http.post(`${base}/datasets`, async ({ request }) => {
      created.push(await request.json());
      return HttpResponse.json(buildDataset({ id: 'replay-dataset' }));
    }),
    http.post(`${base}/datasets/replay-dataset/items/from-thread`, async ({ request }) => {
      inserted.push(await request.json());
      return HttpResponse.json(buildReplayCreated(turnCount));
    }),
  );
  render(
    <MastraReactProvider baseUrl="http://localhost:4111">
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
      >
        <CreateReplayDatasetDialog
          source={{ agentId: 'support', threadId: 'golden', resourceId: 'customer' }}
          onClose={() => {}}
        />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
  return { previews, created, inserted, listed };
}

describe('CreateReplayDatasetDialog', () => {
  describe('when creating a replay from a recorded conversation', () => {
    it('previews the agent default, includes all history when selected, and offers to run the new dataset', async () => {
      const requests = setup();
      await screen.findByText('10 completed turns');
      screen.getByText('10 prior messages per turn');
      expect(requests.previews[0]).toEqual({ agentId: 'support', threadId: 'golden', resourceId: 'customer' });
      fireEvent.click(screen.getByRole('checkbox', { name: 'Include all prior messages' }));
      await waitFor(() => expect(requests.previews.at(-1)).toMatchObject({ historyLimit: false }));
      const submit = screen.getByRole('button', { name: 'Create replay dataset' });
      await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
      fireEvent.click(submit);
      await screen.findByRole('button', { name: 'Run experiment' });
      expect(requests.created).toEqual([{ name: 'Golden thread replay', targetType: 'agent', targetIds: ['support'] }]);
      // Only agent datasets are offered as import targets.
      expect(requests.listed[0]).toContain('targetType=agent');
      expect(requests.inserted).toEqual([
        { agentId: 'support', threadId: 'golden', resourceId: 'customer', historyLimit: false },
      ]);
    });

    it('imports a whole conversation without a history window', async () => {
      const requests = setup();
      await screen.findByText(/10 completed turns/);
      fireEvent.change(screen.getByLabelText('Prior messages per turn'), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('radio', { name: /Whole conversation/ }));
      await screen.findByText('10 turns → 1 conversation');
      expect(screen.queryByLabelText('Prior messages per turn')).toBeNull();
      expect(screen.getByText(/User messages stay fixed/)).toBeTruthy();
      const submit = screen.getByRole('button', { name: 'Create replay dataset' });
      await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false));
      fireEvent.click(submit);
      await screen.findByRole('button', { name: 'Run experiment' });
      expect(requests.inserted).toEqual([
        {
          agentId: 'support',
          threadId: 'golden',
          resourceId: 'customer',
          mode: 'conversation',
        },
      ]);
    });

    it('does not create an empty replay or submit an invalid history window', async () => {
      const requests = setup(0);
      await screen.findByText('0 completed turns');
      screen.getByText('10 prior messages per turn');
      expect(screen.getByRole('button', { name: 'Create replay dataset' }).hasAttribute('disabled')).toBe(true);
      fireEvent.change(screen.getByLabelText('Prior messages per turn'), { target: { value: '-1' } });
      await screen.findByRole('alert');
      expect(requests.previews).toHaveLength(1);
      expect(requests.created).toEqual([]);
      expect(requests.inserted).toEqual([]);
    });
  });
});
